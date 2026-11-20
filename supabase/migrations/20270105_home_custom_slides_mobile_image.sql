-- Własne slajdy: osobna grafika banera na telefon (kadr 4:3), żeby danie nie chowało się pod tytułem.

alter table public.home_custom_slides
  add column if not exists image_mobile_url text;
