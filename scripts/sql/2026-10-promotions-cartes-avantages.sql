-- 19/10/2026 — Promotions : nouvelle catégorie « Cartes avantages » (kind = 'card')
-- Une carte n'est pas liée à un club : club_id devient facultatif, mais seulement pour ce type.
-- À exécuter une seule fois dans Supabase → SQL Editor (relançable sans risque).

alter table public.club_promotions alter column club_id drop not null;

alter table public.club_promotions drop constraint if exists club_promotions_kind_check;
alter table public.club_promotions add constraint club_promotions_kind_check
  check (kind = any (array['promo','twilight','winter','pack','card']));

alter table public.club_promotions drop constraint if exists club_promotions_club_required;
alter table public.club_promotions add constraint club_promotions_club_required
  check (kind = 'card' or club_id is not null);

-- Cartes de départ (modifiables / supprimables ensuite depuis la page par un admin)
insert into public.club_promotions (club_id, kind, title, price_text, description, source_url, origin, verified_on)
select null, 'card', v.title, v.price_text, v.description, v.source_url, 'manual', current_date
from (values
  ('Golf.be',
   '89 € / an',
   'Assurance annuelle (cotisation du club, matériel, hole-in-one), compétitions et voyages réservés aux membres, réductions sur les green fees en Belgique et à l''étranger, avantages Golfy inclus.',
   'https://www.golf.be/fr/affaires'),
  ('Golfy Indigo',
   '79 € / an',
   '25 % de remise sur les green fees du réseau Golfy (plus de 190 parcours).',
   'https://www.golfy.fr/en/cards/'),
  ('Golfy Platine',
   '191 € / an',
   '30 % de remise sur les green fees du réseau Golfy (plus de 190 parcours).',
   'https://www.golfy.fr/en/cards/')
) as v(title, price_text, description, source_url)
where not exists (
  select 1 from public.club_promotions p where p.kind = 'card' and p.title = v.title
);
