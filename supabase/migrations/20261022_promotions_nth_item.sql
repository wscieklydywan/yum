-- Promocje typu "N-ta sztuka w specjalnej cenie" (np. "Drugi burger za 10 zł", "Trzecia pizza gratis")
-- oraz wykluczanie konkretnych produktów z zakresu promocji.
alter table public.promotions
  add column if not exists kind text not null default 'percent',
  add column if not exists buy_quantity smallint not null default 1,
  add column if not exists reward_price numeric(8,2),
  add column if not exists excluded_product_ids text[] not null default '{}';

alter table public.promotions drop constraint if exists promotions_discount_percent_check;
alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions drop constraint if exists promotions_buy_quantity_check;
alter table public.promotions drop constraint if exists promotions_reward_check;

alter table public.promotions
  add constraint promotions_kind_check check (kind in ('percent', 'nth_item')),
  add constraint promotions_buy_quantity_check check (buy_quantity between 1 and 9),
  add constraint promotions_discount_percent_check check (discount_percent >= 0 and discount_percent <= 90),
  add constraint promotions_reward_check check (
    (kind = 'percent' and discount_percent > 0)
    or (kind = 'nth_item' and ((reward_price is not null and reward_price >= 0) or discount_percent > 0))
  );
