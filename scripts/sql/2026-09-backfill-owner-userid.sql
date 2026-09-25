-- GolfGo — répare les owners "orphelins" : rôle owner enregistré, mais jamais relié à leur compte
--
-- Cause : promouvoir un membre en owner depuis sa fiche n'enregistrait que le rôle, jamais le lien
-- vers son compte (groups_players.user_id). Sans ce lien, la personne garde ses droits d'administration,
-- mais n'apparaît ni dans le menu du signataire, ni parmi les personnes alertées en cas de souci sur
-- les flights. Le correctif applicatif empêche que ça se reproduise ; cette requête répare l'existant.
--
-- Ne touche QUE les lignes owner dont le lien manque encore, et seulement si le joueur a bien un
-- compte à relier. Peut être relancée sans risque.

update public.groups_players gp
set user_id = p.user_id
from public.players p
where gp.player_id = p.id
  and gp.role = 'owner'
  and gp.user_id is null
  and p.user_id is not null;

-- Vérification : doit maintenant afficher un user_id pour CHAQUE ligne "owner"
select gp.group_id, p.first_name, p.surname, gp.role, gp.user_id
from public.groups_players gp
join public.players p on p.id = gp.player_id
where gp.role = 'owner'
order by gp.group_id, p.first_name;
