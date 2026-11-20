-- Własne slajdy: tryb grafiki. „circle” = zdjęcie w kole obok tekstu (dotychczasowy wygląd),
-- „cover” = gotowa grafika na cały slajd (baner), tekst i przycisk leżą na niej.

alter table public.home_custom_slides
  add column if not exists image_mode text not null default 'circle';

alter table public.home_custom_slides
  drop constraint if exists home_custom_slides_image_mode_check;

alter table public.home_custom_slides
  add constraint home_custom_slides_image_mode_check check (image_mode in ('circle', 'cover'));
