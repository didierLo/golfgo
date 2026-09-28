-- GolfGo — échecs d'envoi d'emails : rattachement au joueur, traitement par l'organisateur, notification
--
-- player_id    : le joueur concerné par l'email (permet à l'organisateur de corriger SON adresse,
--                même si elle a changé depuis l'échec)
-- resolved_at  : renseigné quand l'organisateur a traité l'échec (renvoyé ou ignoré) — il disparaît alors des listes
-- notified_at  : renseigné quand les organisateurs du groupe ont reçu une notification push pour cet échec
--                (sert à ne pas les notifier à chaque email d'une même rafale)
--
-- Purement additif. Peut être relancée sans risque.

alter table public.email_queue
  add column if not exists player_id   uuid references public.players(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists notified_at timestamptz;

create index if not exists email_queue_group_open_failures_idx
  on public.email_queue (group_id, created_at desc)
  where status = 'failed' and resolved_at is null;

-- Rattache les anciens échecs à leur joueur, UNIQUEMENT quand c'est sans ambiguïté :
-- une seule personne du groupe porte cette adresse.
update public.email_queue q
set player_id = m.pid
from (
  select q2.id as qid, (array_agg(p.id))[1] as pid
  from public.email_queue q2
  join public.groups_players gp on gp.group_id = q2.group_id
  join public.players p on p.id = gp.player_id and lower(p.email) = lower(q2.to_email)
  where q2.player_id is null and q2.group_id is not null
  group by q2.id
  having count(distinct p.id) = 1
) m
where q.id = m.qid;
