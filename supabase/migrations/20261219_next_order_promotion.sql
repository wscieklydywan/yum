-- Promocja "Nagroda za kolejne zamówienie" (np. frytki gratis przy 2. zamówieniu ze strony).
-- buy_quantity = ile wcześniejszych zamówień musi mieć klient (1 = nagroda przy 2. zamówieniu).
alter table public.promotions drop constraint if exists promotions_kind_check;
alter table public.promotions add constraint promotions_kind_check check (kind in ('percent', 'nth_item', 'next_order'));

alter table public.promotions drop constraint if exists promotions_reward_check;
alter table public.promotions add constraint promotions_reward_check check (
  (kind = 'percent' and discount_percent > 0)
  or (kind in ('nth_item', 'next_order') and ((reward_price is not null and reward_price >= 0) or discount_percent > 0))
);

-- Liczba wcześniejszych (nieanulowanych) zamówień ze strony dla klienta – po koncie albo po numerze telefonu (ostatnie 9 cyfr).
create or replace function public.count_previous_site_orders(p_customer uuid, p_phone text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.orders o
  where o.source = 'yummy'
    and o.status <> 'cancelled'
    and (
      (p_customer is not null and o.customer_id = p_customer)
      or (
        length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
        and right(regexp_replace(coalesce(o.phone, ''), '\D', '', 'g'), 9) = right(regexp_replace(p_phone, '\D', '', 'g'), 9)
      )
    );
$$;

revoke all on function public.count_previous_site_orders(uuid, text) from public, anon, authenticated;
grant execute on function public.count_previous_site_orders(uuid, text) to service_role;
