-- Płacenie Stars w koszyku: 1 Star obniża paragon o ustaloną kwotę (Warsztat → Marketing → Płacenie punktami).

alter table public.restaurant_settings
  add column if not exists points_payment_enabled boolean not null default false,
  add column if not exists points_payment_value numeric(10, 2) not null default 1,
  add column if not exists points_payment_max_percent integer not null default 100;

alter table public.restaurant_settings drop constraint if exists restaurant_settings_points_payment_value_check;
alter table public.restaurant_settings add constraint restaurant_settings_points_payment_value_check
  check (points_payment_value > 0 and points_payment_value <= 1000);
alter table public.restaurant_settings drop constraint if exists restaurant_settings_points_payment_max_percent_check;
alter table public.restaurant_settings add constraint restaurant_settings_points_payment_max_percent_check
  check (points_payment_max_percent between 1 and 100);

-- points_discount is already included in orders.discount, so every existing total/receipt/Stars calculation stays correct.
alter table public.orders
  add column if not exists points_used integer not null default 0,
  add column if not exists points_discount numeric(10, 2) not null default 0,
  add column if not exists points_refunded boolean not null default false;

alter table public.orders drop constraint if exists orders_points_used_check;
alter table public.orders add constraint orders_points_used_check check (points_used >= 0 and points_discount >= 0);

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind in ('spin', 'spin_cost', 'staff', 'redeem', 'promo', 'purchase', 'refund', 'game', 'advent', 'payment'));

-- Called only by /api/orders (service role) before the order is inserted; locks the profile so Stars cannot be spent twice.
create or replace function public.spend_order_points(p_user uuid, p_points integer, p_note text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  balance integer;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'invalid_points' using errcode = '22023';
  end if;
  select points into balance from public.profiles where id = p_user for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if balance < p_points then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;
  update public.profiles set points = points - p_points where id = p_user returning points into balance;
  insert into public.point_transactions (user_id, amount, kind, note)
  values (p_user, -p_points, 'payment', left(coalesce(p_note, 'Płatność Stars'), 200));
  return balance;
end;
$$;

-- Returns Stars when the order could not be saved after they were taken.
create or replace function public.return_order_points(p_user uuid, p_points integer, p_note text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_points is null or p_points <= 0 then return; end if;
  update public.profiles set points = points + p_points where id = p_user;
  if found then
    insert into public.point_transactions (user_id, amount, kind, note)
    values (p_user, p_points, 'refund', left(coalesce(p_note, 'Zwrot Stars'), 200));
  end if;
end;
$$;

revoke all on function public.spend_order_points(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.return_order_points(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.spend_order_points(uuid, integer, text) to service_role;
grant execute on function public.return_order_points(uuid, integer, text) to service_role;

-- Cancelling an order gives the Stars back; restoring a cancelled order takes them again (never below zero).
create or replace function private.orders_points_payment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.points_used <= 0 or new.customer_id is null then
    return new;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' and not new.points_refunded then
    update public.profiles set points = points + new.points_used where id = new.customer_id;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (new.customer_id, new.points_used, 'refund', 'Zwrot Stars – anulowane zamówienie #' || new.number);
    new.points_refunded := true;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' and new.points_refunded then
    update public.profiles set points = points - least(points, new.points_used) where id = new.customer_id;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (new.customer_id, -new.points_used, 'payment', 'Przywrócone zamówienie #' || new.number);
    new.points_refunded := false;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_points_payment on public.orders;
create trigger orders_points_payment
  before update of status on public.orders
  for each row execute function private.orders_points_payment();
