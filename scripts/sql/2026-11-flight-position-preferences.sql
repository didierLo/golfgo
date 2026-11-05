-- Souhaits « premier flight » / « dernier flight », par groupe et par joueur.
-- (Déjà appliqué sur le projet Supabase le 2026-11-05 ; ce fichier garde l'historique dans le dépôt.)

create table if not exists public.player_flight_preferences (
  group_id   uuid        not null references public.groups(id)  on delete cascade,
  player_id  uuid        not null references public.players(id) on delete cascade,
  preference text        not null check (preference in ('first', 'last')),
  created_at timestamptz not null default now(),
  primary key (group_id, player_id)
);

create index if not exists player_flight_preferences_player_id_idx
  on public.player_flight_preferences (player_id);

alter table public.player_flight_preferences enable row level security;

-- Mêmes droits que player_pair_constraints : réservé aux administrateurs du groupe.
create policy pfp_select on public.player_flight_preferences
  for select to authenticated
  using (group_id in (select public.my_owned_group_ids()));

create policy pfp_insert on public.player_flight_preferences
  for insert to authenticated
  with check (group_id in (select public.my_owned_group_ids()));

create policy pfp_update on public.player_flight_preferences
  for update to authenticated
  using (group_id in (select public.my_owned_group_ids()))
  with check (group_id in (select public.my_owned_group_ids()));

create policy pfp_delete on public.player_flight_preferences
  for delete to authenticated
  using (group_id in (select public.my_owned_group_ids()));
