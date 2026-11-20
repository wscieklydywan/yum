-- Własne slajdy na stronie głównej (Warsztat → Marketing → Slider). Mogą być powiązane z daniem z menu
-- (np. danie sezonowe) albo prowadzić do dowolnego linku. Kolejność/ukrycie trzymane w home_slides_settings
-- jako wpisy „custom:<uuid>” w slide_order / hidden_slides.

create table if not exists public.home_custom_slides (
  id uuid primary key default gen_random_uuid(),
  badge text not null default '' check (char_length(badge) <= 30),
  title text not null check (char_length(title) between 1 and 60),
  text text not null default '' check (char_length(text) <= 240),
  image_url text check (image_url is null or char_length(image_url) <= 500),
  product_id text references public.menu_products (id) on delete set null,
  cta_label text not null default '' check (char_length(cta_label) <= 30),
  cta_href text check (cta_href is null or char_length(cta_href) <= 300),
  theme text not null default 'yellow' check (theme in ('yellow', 'dark', 'red', 'cream')),
  until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.home_custom_slides enable row level security;
-- Brak polityk: dostęp wyłącznie przez klucz serwisowy.
