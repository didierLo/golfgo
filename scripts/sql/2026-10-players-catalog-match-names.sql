-- GolfGo — import Excel sans n° fédéral : rapprochement des joueurs par nom
--
-- Contexte : l'import ne retrouvait un joueur existant que par n° fédéral. Une ligne sans n° fédéral devenait
-- un « nouveau joueur » (doublon). Cette fonction propose, pour chaque ligne du fichier, les joueurs de `players`
-- dont le nom correspond (sans tenir compte des majuscules, accents, tirets, ni de l'ordre des mots :
-- « NGUYEN TM » + « TRANG » = « TM TRANG » + « NGUYEN »).
--
-- Même niveau de confidentialité que catalog_lookup : identifiant et n° fédéral pour tous les candidats ;
-- nom, email, téléphone, club et handicap uniquement pour les joueurs qui partagent déjà un groupe avec l'appelant.
-- Réservée aux organisateurs du groupe indiqué. Purement additif. Peut être relancé sans risque.

create or replace function public.golfgo_norm_name(p text)
returns text
language sql stable set search_path = public
as $$
  select coalesce(string_agg(w, ' ' order by w), '')
  from unnest(string_to_array(regexp_replace(public.unaccent(lower(coalesce(p, ''))), '[^a-z0-9]+', ' ', 'g'), ' ')) as w
  where w <> ''
$$;

-- p_names : [{"i": 0, "first_name": "Anne", "surname": "ALS"}, ...]  →  une ligne par (ligne du fichier, candidat)
create or replace function public.catalog_match_names(p_group_id uuid, p_names jsonb)
returns table (idx int, federal_no text, id uuid, visible boolean, first_name text, surname text,
               whs numeric, email text, phone text, home_club text)
language plpgsql security definer set search_path = public stable
as $$
begin
  perform public.catalog_assert_organizer(p_group_id);
  return query
    with mine as (select public.cogroup_player_ids() as pid),
    wanted as (
      select (e->>'i')::int as i,
             public.golfgo_norm_name(coalesce(e->>'first_name', '') || ' ' || coalesce(e->>'surname', '')) as n
      from jsonb_array_elements(p_names) e
    )
    select w.i, p.federal_no::text, p.id,
           (p.id in (select pid from mine)) as visible,
           case when p.id in (select pid from mine) then p.first_name::text end,
           case when p.id in (select pid from mine) then p.surname::text end,
           case when p.id in (select pid from mine) then p.whs::numeric end,
           case when p.id in (select pid from mine) then p.email::text end,
           case when p.id in (select pid from mine) then p.phone::text end,
           case when p.id in (select pid from mine) then p.home_club::text end
    from wanted w
    join players p on w.n <> '' and public.golfgo_norm_name(coalesce(p.first_name, '') || ' ' || coalesce(p.surname, '')) = w.n;
end $$;

revoke all on function public.golfgo_norm_name(text)               from public, anon;
revoke all on function public.catalog_match_names(uuid, jsonb)     from public, anon;
grant execute on function public.golfgo_norm_name(text)            to authenticated;
grant execute on function public.catalog_match_names(uuid, jsonb)  to authenticated;
