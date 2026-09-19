-- GolfGo — langue par groupe (emails, documents envoyés aux joueurs)
-- À exécuter UNE FOIS dans Supabase (SQL Editor) AVANT de déployer le code du lot 3A.
-- Les groupes existants gardent le français (comportement actuel).

alter table public.groups
  add column if not exists locale text not null default 'fr';

alter table public.groups
  drop constraint if exists groups_locale_check;

alter table public.groups
  add constraint groups_locale_check check (locale in ('fr', 'en', 'nl', 'de', 'es'));

-- Vérification : doit afficher tous vos groupes avec locale = 'fr'
-- select id, name, locale from public.groups order by name;
