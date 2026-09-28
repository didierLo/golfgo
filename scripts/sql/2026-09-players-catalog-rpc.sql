-- GolfGo — accès contrôlé au catalogue des joueurs (étape A, préparatoire : n'change encore aucun droit)
--
-- Contexte : la règle de lecture des joueurs laisse aujourd'hui tout organisateur lire TOUS les joueurs de la
-- plateforme (noms, emails, téléphones…). Les écrans « Ajouter un membre » et « Import » en dépendent : recherche
-- d'un joueur d'un autre groupe, détection des doublons par numéro fédéral, import.
--
-- Ces deux fonctions donnent à ces écrans ce dont ils ont besoin, et RIEN de plus, pour que la lecture directe
-- puisse ensuite être refermée (étape B) sans les casser :
--   catalog_search  : cherche un joueur (nom, prénom, n° fédéral) → identité minimale, 10 résultats maximum
--   catalog_lookup  : retrouve des joueurs par n° fédéral → leur identifiant ; nom, email, téléphone, club et
--                     handicap ne sont fournis que pour les joueurs qui partagent DÉJÀ un groupe avec l'appelant
-- Réservées aux organisateurs du groupe indiqué. Purement additif. Peut être relancé sans risque.

create or replace function public.catalog_assert_organizer(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public stable
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (
    exists (select 1 from groups g where g.id = p_group_id and g.owner_id = auth.uid())
    or exists (select 1 from groups_players gp where gp.group_id = p_group_id and gp.role = 'owner' and gp.user_id = auth.uid())
    or exists (select 1 from groups_players gp join players p on p.id = gp.player_id
               where gp.group_id = p_group_id and gp.role = 'owner' and p.user_id = auth.uid())
  ) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
end $$;

create or replace function public.catalog_search(p_group_id uuid, p_term text)
returns table (id uuid, first_name text, surname text, federal_no text, whs numeric)
language plpgsql security definer set search_path = public stable
as $$
declare
  t text := trim(coalesce(p_term, ''));
begin
  perform public.catalog_assert_organizer(p_group_id);
  if char_length(t) < 2 then return; end if;
  -- les caractères spéciaux de ILIKE sont traités comme du texte : « % » ne renvoie pas tout le catalogue
  t := replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.id, p.first_name::text, p.surname::text, p.federal_no::text, p.whs::numeric
    from players p
    where p.federal_no ilike '%' || t || '%'
       or p.first_name ilike '%' || t || '%'
       or p.surname    ilike '%' || t || '%'
    order by p.surname, p.first_name
    limit 10;
end $$;

create or replace function public.catalog_lookup(p_group_id uuid, p_federals text[])
returns table (federal_no text, id uuid, visible boolean, first_name text, surname text,
               whs numeric, email text, phone text, home_club text)
language plpgsql security definer set search_path = public stable
as $$
begin
  perform public.catalog_assert_organizer(p_group_id);
  return query
    with mine as (select public.cogroup_player_ids() as pid)
    select p.federal_no::text, p.id,
           (p.id in (select pid from mine)) as visible,
           case when p.id in (select pid from mine) then p.first_name::text end,
           case when p.id in (select pid from mine) then p.surname::text end,
           case when p.id in (select pid from mine) then p.whs::numeric end,
           case when p.id in (select pid from mine) then p.email::text end,
           case when p.id in (select pid from mine) then p.phone::text end,
           case when p.id in (select pid from mine) then p.home_club::text end
    from players p
    where p.federal_no = any (p_federals);
end $$;

-- Réservées aux utilisateurs connectés (jamais aux anonymes)
revoke all on function public.catalog_assert_organizer(uuid) from public, anon, authenticated;
revoke all on function public.catalog_search(uuid, text)     from public, anon;
revoke all on function public.catalog_lookup(uuid, text[])   from public, anon;
grant execute on function public.catalog_search(uuid, text)   to authenticated;
grant execute on function public.catalog_lookup(uuid, text[]) to authenticated;
