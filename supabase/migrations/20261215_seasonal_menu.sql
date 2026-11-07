-- Seasonal / limited-time menu items: own emblem and optional end date after which they stop being orderable.
alter table public.menu_products
  add column if not exists seasonal boolean not null default false,
  add column if not exists seasonal_label text,
  add column if not exists available_until timestamptz;

alter table public.menu_products drop constraint if exists menu_products_seasonal_label_length;
alter table public.menu_products
  add constraint menu_products_seasonal_label_length check (seasonal_label is null or char_length(seasonal_label) <= 30);

create index if not exists menu_products_seasonal_idx on public.menu_products (available_until) where seasonal;
