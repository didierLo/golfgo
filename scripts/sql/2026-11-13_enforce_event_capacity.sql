-- Capacité des événements : un joueur qui passe à GOING sur un événement complet
-- est placé en WAITLIST. Un admin (owner) du groupe peut forcer un surnombre
-- (l'interface l'affiche alors en rouge). Déjà appliqué sur Supabase le 13/11/2026.
create or replace function public.enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max   int;
  v_gid   uuid;
  v_going int;
begin
  if new.status::text <> 'GOING' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status::text = 'GOING' then
    return new;
  end if;

  select max_participants, group_id into v_max, v_gid
  from events where id = new.event_id;

  if v_max is null then
    return new;
  end if;

  if public.is_group_owner(v_gid) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.event_id::text));

  select count(*) into v_going
  from event_participants
  where event_id = new.event_id
    and status = 'GOING'
    and id is distinct from new.id;

  if v_going >= v_max then
    new.status := 'WAITLIST';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_event_capacity on public.event_participants;
create trigger trg_enforce_event_capacity
  before insert or update of status on public.event_participants
  for each row execute function public.enforce_event_capacity();
