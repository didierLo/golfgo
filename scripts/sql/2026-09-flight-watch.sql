-- GolfGo — surveillance « participants OUI ↔ flights » : retrait automatique + mémoire des alertes
--
-- À exécuter UNE FOIS dans Supabase → SQL Editor, AVANT de déployer le code correspondant.
-- Peut être relancé sans risque (il ne recrée que ce qui manque).
--
-- CE QUE ÇA FAIT
--   1. Quand un joueur n'est plus « OUI » (il refuse, passe en liste d'attente…) OU quand sa participation
--      est supprimée, il est automatiquement retiré des flights de cet événement (événements à venir uniquement :
--      l'historique des événements passés n'est jamais modifié).
--      → règle « il n'y a que des OUI dans les flights » garantie par la base, quel que soit le chemin
--        (lien de réponse du joueur, page Participants, annulation d'invitation…).
--   2. Chaque retrait est noté dans un journal (flight_removal_log) pour te prévenir UNE seule fois.
--   3. Une table (flight_issue_alerts) retient la dernière alerte envoyée par événement :
--      c'est ce qui permet de ne PAS te renvoyer de notification quand rien n'a changé.
--
-- CE QUE ÇA NE FAIT PAS : ajouter quelqu'un à un flight (c'est ton choix : quel flight ?).
--   Un nouveau « OUI » sans flight sera signalé par l'alerte du matin.

-- ── 1. Journal des retraits automatiques ─────────────────────────────────────────────────────
create table if not exists public.flight_removal_log (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid        not null,
  player_id     uuid        not null,
  flight_number integer,
  reason        text        not null,            -- 'STATUS:DECLINED', 'STATUS:WAITLIST', 'PARTICIPATION_DELETED'…
  created_at    timestamptz not null default now(),
  notified_at   timestamptz                       -- renseigné quand l'organisateur a été prévenu
);
create index if not exists flight_removal_log_pending_idx
  on public.flight_removal_log (event_id) where notified_at is null;

-- ── 2. Mémoire de la dernière alerte par événement ───────────────────────────────────────────
create table if not exists public.flight_issue_alerts (
  event_id          uuid primary key,
  signature         text        not null,         -- empreinte de la liste des écarts déjà signalés
  teesheet_notified boolean     not null default false,  -- l'alerte « tee sheet envoyé avec des écarts » a été faite
  notified_at       timestamptz not null default now()
);

-- Ces deux tables sont réservées au serveur (clé « service role ») : aucun accès depuis le navigateur.
alter table public.flight_removal_log  enable row level security;
alter table public.flight_issue_alerts enable row level security;
revoke all on public.flight_removal_log  from anon, authenticated;
revoke all on public.flight_issue_alerts from anon, authenticated;

-- ── 3. Retrait automatique des flights ───────────────────────────────────────────────────────
create or replace function public.remove_from_flights_when_not_going()
returns trigger
language plpgsql
security definer                      -- s'exécute avec les droits du propriétaire : fonctionne aussi quand c'est un joueur
set search_path = public              -- qui répond depuis son lien (fonctions rsvp_*) et n'a pas accès aux flights
as $$
declare
  v_event  uuid;
  v_player uuid;
  v_reason text;
begin
  if tg_op = 'DELETE' then
    v_event := old.event_id;  v_player := old.player_id;  v_reason := 'PARTICIPATION_DELETED';
  else
    if new.status::text = 'GOING' then
      return new;                     -- « OUI » : rien à retirer
    end if;
    v_event := new.event_id;  v_player := new.player_id;  v_reason := 'STATUS:' || new.status::text;
  end if;

  with removed as (
    delete from public.flight_players fp
    using public.flights f
    where fp.flight_id = f.id
      and f.event_id   = v_event
      and fp.player_id = v_player
      -- jamais sur l'HISTORIQUE : un événement terminé depuis plus d'un jour garde ses flights tels qu'ils ont été joués
      and exists (select 1 from public.events e where e.id = f.event_id and e.starts_at >= now() - interval '1 day')
    returning f.flight_number
  )
  insert into public.flight_removal_log (event_id, player_id, flight_number, reason)
  select v_event, v_player, flight_number, v_reason from removed;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_remove_from_flights_on_status on public.event_participants;
create trigger trg_remove_from_flights_on_status
  after update of status on public.event_participants
  for each row execute function public.remove_from_flights_when_not_going();

drop trigger if exists trg_remove_from_flights_on_delete on public.event_participants;
create trigger trg_remove_from_flights_on_delete
  after delete on public.event_participants
  for each row execute function public.remove_from_flights_when_not_going();

-- ── Pour tout annuler ────────────────────────────────────────────────────────────────────────
-- drop trigger if exists trg_remove_from_flights_on_status on public.event_participants;
-- drop trigger if exists trg_remove_from_flights_on_delete on public.event_participants;
-- drop function if exists public.remove_from_flights_when_not_going();
-- (les tables flight_removal_log et flight_issue_alerts peuvent rester : elles sont inoffensives)
