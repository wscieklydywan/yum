-- Własne slajdy: przypisanie grafiki do rodzaju treści (danie, sezonowe, burger tygodnia, promocja, wydarzenie, inne).

alter table public.home_custom_slides
  add column if not exists kind text not null default 'other';

alter table public.home_custom_slides
  drop constraint if exists home_custom_slides_kind_check;

alter table public.home_custom_slides
  add constraint home_custom_slides_kind_check check (kind in ('dish', 'seasonal', 'burger_week', 'promo', 'event', 'other'));

-- Istniejące slajdy powiązane z daniem dostają przypisanie „danie”.
update public.home_custom_slides set kind = 'dish' where product_id is not null and kind = 'other';
