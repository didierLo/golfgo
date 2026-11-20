-- Sondages de dates (type Doodle) : « qui serait partant pour un hors club à X, à l'une de ces dates ? »
-- Les heures sont stockées comme celles de events.starts_at (heure locale belge, lue en UTC).

create table if not exists public.polls (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  title            text not null,
  description      text,
  club_id          uuid references public.clubs(id) on delete set null,
  location         text,
  deadline         date,
  status           text not null default 'open' check (status in ('open','closed','converted')),
  event_id         uuid references public.events(id) on delete set null,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  last_reminder_at timestamptz
);

create table if not exists public.poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  starts_at  timestamptz not null,
  position   int not null default 0
);

create table if not exists public.poll_voters (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references public.polls(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  notified_at timestamptz,
  unique (poll_id, player_id)
);

create table if not exists public.poll_votes (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  option_id  uuid not null references public.poll_options(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  answer     text not null check (answer in ('yes','maybe','no')),
  updated_at timestamptz not null default now(),
  unique (option_id, player_id)
);

create index if not exists poll_options_poll_idx on public.poll_options(poll_id);
create index if not exists poll_voters_player_idx on public.poll_voters(player_id);
create index if not exists poll_votes_poll_idx on public.poll_votes(poll_id);

-- ── Helpers (SECURITY DEFINER : évitent la récursion RLS) ──
create or replace function public.poll_group(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from polls where id = pid;
$$;

create or replace function public.poll_is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_group_owner(gid) or exists (
    select 1 from groups_players gp
    where gp.group_id = gid
      and (gp.user_id = auth.uid() or gp.player_id = public.auth_player_id())
  );
$$;

-- ── RLS ──
alter table public.polls        enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_voters  enable row level security;
alter table public.poll_votes   enable row level security;

create policy polls_select on public.polls for select to authenticated
  using (public.poll_is_group_member(group_id));
create policy polls_owner_write on public.polls for all to authenticated
  using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

create policy poll_options_select on public.poll_options for select to authenticated
  using (public.poll_is_group_member(public.poll_group(poll_id)));
create policy poll_options_owner_write on public.poll_options for all to authenticated
  using (public.is_group_owner(public.poll_group(poll_id)))
  with check (public.is_group_owner(public.poll_group(poll_id)));

-- Un joueur ne voit que sa propre ligne ; l'organisateur voit tout (pour envoyer les liens et relancer)
create policy poll_voters_select on public.poll_voters for select to authenticated
  using (public.is_group_owner(public.poll_group(poll_id)) or player_id = public.auth_player_id());
create policy poll_voters_owner_write on public.poll_voters for all to authenticated
  using (public.is_group_owner(public.poll_group(poll_id)))
  with check (public.is_group_owner(public.poll_group(poll_id)));

-- Les réponses nominatives ne sont lisibles que par l'organisateur (les joueurs ne voient que les totaux, via poll_get)
create policy poll_votes_owner_select on public.poll_votes for select to authenticated
  using (public.is_group_owner(public.poll_group(poll_id)));

-- ── Lecture d'un sondage par jeton (page de vote, sans connexion) ──
create or replace function public.poll_get(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v poll_voters; p polls; res jsonb;
begin
  select * into v from poll_voters where token = p_token;
  if not found then return null; end if;
  select * into p from polls where id = v.poll_id;
  select jsonb_build_object(
    'poll_id',         p.id,
    'title',           p.title,
    'description',     p.description,
    'location',        p.location,
    'status',          p.status,
    'deadline',        p.deadline,
    'event_id',        p.event_id,
    'group_id',        p.group_id,
    'group_name',      (select name from groups where id = p.group_id),
    'club',            (select jsonb_build_object('name', c.name, 'website', c.website, 'region', c.region, 'country', c.country, 'course', (select course_name from courses where club_id = c.id order by course_name limit 1)) from clubs c where c.id = p.club_id),
    'player_name',     (select first_name from players where id = v.player_id),
    'can_vote',        (p.status = 'open' and (p.deadline is null or p.deadline >= (now() at time zone 'Europe/Brussels')::date)),
    'voters_total',    (select count(*) from poll_voters where poll_id = p.id),
    'voters_answered', (select count(distinct player_id) from poll_votes where poll_id = p.id),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',        o.id,
        'starts_at', o.starts_at,
        'yes',   (select count(*) from poll_votes x where x.option_id = o.id and x.answer = 'yes'),
        'maybe', (select count(*) from poll_votes x where x.option_id = o.id and x.answer = 'maybe'),
        'no',    (select count(*) from poll_votes x where x.option_id = o.id and x.answer = 'no'),
        'mine',  (select x.answer from poll_votes x where x.option_id = o.id and x.player_id = v.player_id)
      ) order by o.starts_at) from poll_options o where o.poll_id = p.id
    ), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

-- ── Enregistrement des réponses : p_answers = [{"option_id": "...", "answer": "yes"|"maybe"|"no"}] ──
create or replace function public.poll_vote(p_token uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v poll_voters; p polls; a jsonb;
begin
  select * into v from poll_voters where token = p_token;
  if not found then raise exception 'invalid_token'; end if;
  select * into p from polls where id = v.poll_id;
  if p.status <> 'open' or (p.deadline is not null and p.deadline < (now() at time zone 'Europe/Brussels')::date) then
    raise exception 'poll_closed';
  end if;
  for a in select * from jsonb_array_elements(p_answers) loop
    if not exists (select 1 from poll_options where id = (a->>'option_id')::uuid and poll_id = p.id) then
      raise exception 'invalid_option';
    end if;
    if (a->>'answer') in ('yes','maybe','no') then
      insert into poll_votes(poll_id, option_id, player_id, answer)
      values (p.id, (a->>'option_id')::uuid, v.player_id, a->>'answer')
      on conflict (option_id, player_id) do update set answer = excluded.answer, updated_at = now();
    else
      delete from poll_votes where option_id = (a->>'option_id')::uuid and player_id = v.player_id;
    end if;
  end loop;
end;
$$;

-- ── Sondages ouverts du joueur connecté (bloc « Sondages » de Mes événements) ──
create or replace function public.my_open_polls()
returns table(token uuid, title text, group_name text, deadline date, answered boolean)
language plpgsql security definer set search_path = public as $$
declare pid uuid := public.auth_player_id();
begin
  if pid is null then return; end if;
  insert into poll_voters(poll_id, player_id)
    select p.id, pid from polls p
    join groups_players gp on gp.group_id = p.group_id and gp.player_id = pid
    where p.status = 'open' and coalesce(gp.role, 'member') <> 'guest'
  on conflict (poll_id, player_id) do nothing;
  return query
    select v.token, p.title, g.name, p.deadline,
           exists (select 1 from poll_votes x where x.poll_id = p.id and x.player_id = pid)
    from poll_voters v
    join polls p on p.id = v.poll_id
    join groups g on g.id = p.group_id
    where v.player_id = pid and p.status = 'open'
      and (p.deadline is null or p.deadline >= (now() at time zone 'Europe/Brussels')::date)
    order by p.created_at desc;
end;
$$;

-- ── Décision de l'organisateur : transformer le sondage en événement ──
-- « partant » → inscrit (GOING), « peut-être » → invité (INVITED) ; les autres restent à ajouter par l'organisateur.
create or replace function public.poll_convert(p_poll_id uuid, p_option_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p polls; o poll_options; new_event uuid; v_course uuid; v_courses int;
begin
  select * into p from polls where id = p_poll_id;
  if not found then raise exception 'poll_not_found'; end if;
  if not public.is_group_owner(p.group_id) then raise exception 'not_owner'; end if;
  if p.status = 'converted' then raise exception 'already_converted'; end if;
  select * into o from poll_options where id = p_option_id and poll_id = p.id;
  if not found then raise exception 'invalid_option'; end if;

  if p.club_id is not null then
    select count(*), min(id::text)::uuid into v_courses, v_course from courses where club_id = p.club_id;
    if v_courses <> 1 then v_course := null; end if;
  end if;

  insert into events(group_id, title, location, starts_at, is_golf, event_kind, course_id)
  values (p.group_id, p.title, p.location, o.starts_at, true, 'competition', v_course)
  returning id into new_event;

  insert into event_participants(event_id, player_id, status, registration_source, responded_at)
  select new_event, x.player_id, case x.answer when 'yes' then 'GOING' else 'INVITED' end::participant_status, 'poll', now()
  from poll_votes x
  where x.option_id = o.id and x.answer in ('yes','maybe')
  on conflict do nothing;

  update polls set status = 'converted', event_id = new_event where id = p.id;
  return new_event;
end;
$$;

revoke all on function public.poll_convert(uuid, uuid) from public, anon;
grant execute on function public.poll_convert(uuid, uuid) to authenticated;
revoke all on function public.my_open_polls() from public, anon;
grant execute on function public.my_open_polls() to authenticated;
grant execute on function public.poll_get(uuid) to anon, authenticated;
grant execute on function public.poll_vote(uuid, jsonb) to anon, authenticated;
