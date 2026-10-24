-- Promocje cykliczne / tematyczne ("w każdą środę -20%", "napoje -30%").
-- Szef/admin je definiuje, bar (kelner) tylko włącza i wyłącza.
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 60),
  description text not null default '' check (char_length(description) <= 200),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 90),
  scope text not null default 'all' check (scope in ('all', 'categories', 'products')),
  category_ids text[] not null default '{}',
  product_ids text[] not null default '{}',
  -- Dni tygodnia ISO: 1 = poniedziałek … 7 = niedziela. Pusta tablica = codziennie.
  days smallint[] not null default '{}',
  start_time time,
  end_time time,
  valid_from date,
  valid_to date,
  online boolean not null default true,
  in_store boolean not null default true,
  active boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.promotions enable row level security;

drop policy if exists promotions_public_read on public.promotions;
create policy promotions_public_read on public.promotions for select using (active);
