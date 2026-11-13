-- Quand max_participants d'un événement augmente (ou est supprimé), les joueurs en
-- liste d'attente passent automatiquement en GOING, du plus ancien au plus récent,
-- dans la limite des places créées. Une baisse du maximum ne rétrograde personne.
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

create or replace function public.events_capacity_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.promote_waitlist(new.id);
  return new;
end;
$$;

drop trigger if exists trg_events_promote_waitlist on public.events;
create trigger trg_events_promote_waitlist
  after update of max_participants on public.events
  for each row
  when (new.max_participants is distinct from old.max_participants)
  execute function public.events_capacity_changed();
