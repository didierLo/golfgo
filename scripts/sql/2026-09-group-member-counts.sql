-- GolfGo — nombre de membres d'un groupe : administrateurs inclus, visiteurs (invités) exclus
--
-- La liste des groupes comptait toutes les lignes de groups_players (administrateurs, membres ET visiteurs), et un
-- simple membre ne voyait qu'UNE ligne (la sienne : règle d'accès aux lignes de groups_players), donc « 1 membre ».
-- Cette fonction donne à chaque personne DU groupe les vrais nombres, sans lui montrer qui est dans la liste.
--
--   members : membres + administrateurs (sans les visiteurs)
--   guests  : visiteurs
--
-- Réservée aux personnes qui font partie du groupe (membres, visiteurs ou organisateurs). Purement additif.
-- Peut être relancée sans risque.

create or replace function public.group_member_counts(p_group_ids uuid[])
returns table (group_id uuid, members bigint, guests bigint)
language sql stable security definer set search_path = public
as $$
  select gp.group_id,
         count(*) filter (where gp.role is distinct from 'guest') as members,
         count(*) filter (where gp.role = 'guest')                as guests
  from groups_players gp
  where gp.group_id = any (p_group_ids)
    and (public.is_group_member(gp.group_id) or public.is_group_owner(gp.group_id))
  group by gp.group_id;
$$;

revoke all on function public.group_member_counts(uuid[]) from public, anon;
grant execute on function public.group_member_counts(uuid[]) to authenticated;
