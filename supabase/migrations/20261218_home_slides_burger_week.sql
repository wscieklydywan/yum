-- Slider na stronie głównej: kolejność i widoczność slajdów + „Burger tygodnia” ustawiany w Warsztacie → Marketing.
-- Klient czyta przez /api/home-slides (klucz serwisowy + cache), warsztat przez /api/workshop/home-slides.

create table if not exists public.home_slides_settings (
  id integer primary key default 1 check (id = 1),
  slide_order text[] not null default array['burgers', 'burger_week', 'advent', 'halloween'],
  hidden_slides text[] not null default array[]::text[],
  burger_week_enabled boolean not null default false,
  burger_week_product_id text references public.menu_products (id) on delete set null,
  burger_week_title text not null default 'Burger tygodnia' check (char_length(burger_week_title) between 1 and 40),
  burger_week_text text not null default '' check (char_length(burger_week_text) <= 200),
  burger_week_until date,
  updated_at timestamptz not null default now()
);
alter table public.home_slides_settings enable row level security;
-- Brak polityk: dostęp wyłącznie przez klucz serwisowy.

insert into public.home_slides_settings (id) values (1) on conflict (id) do nothing;
