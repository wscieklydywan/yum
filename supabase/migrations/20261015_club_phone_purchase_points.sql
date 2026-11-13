-- Yummy Club: numer telefonu w profilu, punkty za zakupy (konfigurowalny przelicznik), zaproszenia.

alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format check (phone is null or phone ~ '^[0-9]{9}$');
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

alter table public.restaurant_settings add column if not exists loyalty_points integer not null default 1;
alter table public.restaurant_settings add column if not exists loyalty_spend numeric(10,2) not null default 1;
alter table public.restaurant_settings drop constraint if exists restaurant_settings_loyalty_check;
alter table public.restaurant_settings add constraint restaurant_settings_loyalty_check
  check (loyalty_points between 0 and 1000 and loyalty_spend > 0 and loyalty_spend <= 1000);

alter table public.orders add column if not exists loyalty_points integer;

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind = any (array['spin','spin_cost','staff','redeem','promo','purchase']));

-- Telefon z rejestracji trafia do profilu. Zajęty numer blokuje rejestrację (komunikat w UI).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  requested_role text := new.raw_app_meta_data ->> 'role';
  requested_phone text := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '');
begin
  if requested_phone is not null and requested_phone !~ '^[0-9]{9}$' then
    requested_phone := null;
  end if;
  if requested_phone is not null and exists (select 1 from public.profiles where phone = requested_phone) then
    raise exception 'phone_taken' using errcode = '23505';
  end if;
  insert into public.profiles (id, email, full_name, role, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    case when requested_role in ('admin','szef','kuchnia','kelner','klient','kierowca') then requested_role else 'klient' end,
    requested_phone
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- Nalicza punkty za zamówienie jednorazowo (orders.loyalty_points chroni przed podwójnym naliczeniem).
create or replace function public.award_purchase_points(p_order_id uuid, p_customer uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  order_total numeric;
  order_number bigint;
  rate_points integer;
  rate_spend numeric;
  earned integer;
begin
  select total, number into order_total, order_number
  from public.orders where id = p_order_id and loyalty_points is null
  for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles where id = p_customer and role = 'klient') then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  select loyalty_points, loyalty_spend into rate_points, rate_spend from public.restaurant_settings where id = 1;
  earned := greatest(0, floor(coalesce(order_total, 0) / coalesce(rate_spend, 1))::integer * coalesce(rate_points, 1));

  update public.orders set loyalty_points = earned, customer_id = p_customer where id = p_order_id;

  if earned > 0 then
    update public.profiles set points = points + earned where id = p_customer;
    insert into public.point_transactions (user_id, amount, kind, note, created_by)
    values (p_customer, earned, 'purchase', 'Zamówienie #' || order_number, p_actor);
  end if;

  return earned;
end;
$function$;

revoke all on function public.award_purchase_points(uuid, uuid, uuid) from public, anon, authenticated;
