-- Yummy Stars: 1 Star za każde 10 zł wydane na produkty (po rabatach), końcówki kwot przechodzą między zakupami.
-- Dwa liczniki: profiles.points (Stars do wykorzystania) i profiles.status_points (postęp do statusu – tylko zakupy).
-- Punkty nalicza trigger przy wydaniu zamówienia; zwrot, anulowanie lub cofnięcie wydania odejmuje je proporcjonalnie.

alter table public.profiles
  add column if not exists status_points integer not null default 0,
  add column if not exists spend_carry numeric(10, 2) not null default 0;

alter table public.orders
  add column if not exists loyalty_base numeric(10, 2),
  add column if not exists club_savings numeric(10, 2) not null default 0;

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind in ('spin', 'spin_cost', 'staff', 'redeem', 'promo', 'purchase', 'refund'));

update public.restaurant_settings set loyalty_points = 1, loyalty_spend = 10 where id = 1;

-- Zakończone zamówienia sprzed tej zmiany nie są przeliczane wstecz.
update public.orders set loyalty_points = coalesce(loyalty_points, 0)
where loyalty_base is null and status in ('handed_off', 'cancelled');

create or replace function private.club_tier_percent(p_status_points integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_status_points >= 300 then 10 when p_status_points >= 100 then 5 else 0 end::numeric;
$$;

-- Wartość produktów po rabatach (bez opakowań i dostawy); przy częściowym zwrocie rabat liczony proporcjonalnie.
create or replace function private.loyalty_base(p_items jsonb, p_discount numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with lines as (
    select
      (item->>'unitPrice')::numeric * (item->>'quantity')::int as gross,
      (item->>'unitPrice')::numeric * greatest(0, (item->>'quantity')::int - coalesce((item->>'refunded')::int, 0)) as net
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
    where item ? 'unitPrice'
      and not (item ? 'packaging')
      and not coalesce((item->>'cancelled')::boolean, false)
  ), totals as (select coalesce(sum(gross), 0) as gross, coalesce(sum(net), 0) as net from lines)
  select case when gross <= 0 then 0
    else greatest(0, round(net - coalesce(p_discount, 0) * net / gross, 2)) end
  from totals;
$$;

create or replace function private.loyalty_apply(p_customer uuid, p_delta numeric, p_note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  carry numeric;
  spendable integer;
  rate_points integer;
  rate_spend numeric;
  total numeric;
  units integer;
  earned integer;
  applied integer;
begin
  if p_delta = 0 then return 0; end if;
  select spend_carry, points into carry, spendable from public.profiles where id = p_customer for update;
  if not found then return 0; end if;
  select loyalty_points, nullif(loyalty_spend, 0) into rate_points, rate_spend from public.restaurant_settings where id = 1;
  rate_points := coalesce(rate_points, 1);
  rate_spend := coalesce(rate_spend, 10);

  total := carry + p_delta;
  units := floor(total / rate_spend)::integer;
  earned := units * rate_points;
  -- Stars wydane wcześniej nie schodzą poniżej zera; status cofa się o pełną wartość zwrotu.
  applied := greatest(earned, -spendable);

  update public.profiles
  set spend_carry = total - units * rate_spend,
      status_points = greatest(0, status_points + earned),
      points = points + applied
  where id = p_customer;

  if applied <> 0 then
    insert into public.point_transactions (user_id, amount, kind, note)
    values (p_customer, applied, case when applied > 0 then 'purchase' else 'refund' end, p_note);
  end if;
  return earned;
end;
$$;

create or replace function private.orders_loyalty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_base numeric := 0;
  new_base numeric := 0;
  earned integer;
begin
  if tg_op = 'UPDATE' then
    if old.loyalty_points is not null and old.loyalty_base is null then
      return new;
    end if;
    old_base := coalesce(old.loyalty_base, 0);
    if old.customer_id is distinct from new.customer_id and old_base > 0 then
      perform private.loyalty_apply(old.customer_id, -old_base, 'Korekta zamówienia #' || old.number);
      old_base := 0;
      new.loyalty_points := 0;
    end if;
  end if;

  if new.status = 'handed_off' and new.customer_id is not null
     and exists (select 1 from public.profiles where id = new.customer_id and role = 'klient') then
    new_base := private.loyalty_base(new.items, new.discount);
  end if;

  if new_base = old_base then
    return new;
  end if;

  earned := private.loyalty_apply(
    new.customer_id,
    new_base - old_base,
    case when new_base > old_base then 'Zamówienie #' || new.number else 'Zwrot / korekta zamówienia #' || new.number end
  );
  new.loyalty_base := new_base;
  new.loyalty_points := coalesce(new.loyalty_points, 0) + earned;
  return new;
end;
$$;

drop trigger if exists zz_orders_loyalty on public.orders;
create trigger zz_orders_loyalty
before insert or update of status, items, discount, customer_id on public.orders
for each row execute function private.orders_loyalty();

drop function if exists public.award_purchase_points(uuid, uuid, uuid);

revoke all on function private.loyalty_apply(uuid, numeric, text) from public, anon, authenticated;
