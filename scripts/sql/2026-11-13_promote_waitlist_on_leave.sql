-- Désistement ou suppression d'un inscrit (GOING) : le premier de la liste d'attente prend sa place.
-- GOING -> WAITLIST décidé par un admin ne promeut personne (choix volontaire).
-- Déjà appliqué sur Supabase le 13/11/2026.
create or replace function public.promote_waitlist(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max      int;
  v_going    int;
  v_free     int;
  v_promoted int := 0;
begin
  select max_participants into v_max from events where id = p_event_id;
  if not found then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  select count(*) into v_going
  from event_participants
  where event_id = p_event_id and status = 'GOING';

  v_free := case when v_max is null then 1000000 else v_max - v_going end;
  if v_free <= 0 then
    return 0;
  end if;

  with next_in_line as (
    select id
    from event_participants
    where event_id = p_event_id and status = 'WAITLIST'
    order by responded_at nulls last, created_at
    limit v_free
  )
  update event_participants ep
     set status = 'GOING'
    from next_in_line n
   where ep.id = n.id;

  get diagnostics v_promoted = row_count;
  return v_promoted;
end;
$$;

revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;

create or replace function public.participants_promote_on_leave()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'DELETE' then
    if old.status::text = 'GOING' then
      perform public.promote_waitlist(old.event_id);
    end if;
    return old;
  end if;

  if old.status::text = 'GOING'
     and new.status::text in ('DECLINED', 'INVITED', 'PENDING', 'CANCELLED') then
    perform public.promote_waitlist(new.event_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_promote_waitlist_on_status on public.event_participants;
create trigger trg_promote_waitlist_on_status
  after update of status on public.event_participants
  for each row
  when (old.status = 'GOING' and new.status is distinct from old.status)
  execute function public.participants_promote_on_leave();

drop trigger if exists trg_promote_waitlist_on_delete on public.event_participants;
create trigger trg_promote_waitlist_on_delete
  after delete on public.event_participants
  for each row
  when (old.status = 'GOING')
  execute function public.participants_promote_on_leave();
