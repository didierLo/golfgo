-- GolfGo — fond de l'application personnalisable par groupe
--
-- Ajoute la colonne qui stocke l'image de fond choisie par un groupe (visible sur ordinateur,
-- tablette et smartphone, à la place de l'image par défaut de GolfGo). Un groupe sans image
-- choisie garde l'image par défaut, sans aucun changement de comportement.
--
-- Peut être relancée sans risque.

alter table public.groups add column if not exists background_url text;
