-- Realizacja kuponów Yummy Club bezpośrednio w bazie (1 zapytanie, 1 transakcja).
-- Dostęp: tylko admin i kelner (kuchnia nie realizuje kuponów).

create or replace function public.workshop_coupon_preview(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result json;
begin
  if coalesce((select private.user_role()), '') not in ('admin', 'kelner') then
    raise exception 'Brak uprawnień do realizacji kuponów.' using errcode = '42501';
  end if;

  select json_build_object(
    'code', r.code,
    'reward', r.reward,
    'items', case when jsonb_array_length(r.items) > 0 then r.items else jsonb_build_array(jsonb_build_object('name', r.reward, 'quantity', 1)) end,
    'expiresAt', r.expires_at,
    'customer', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Klient Yummy Club')
  ) into result
  from public.reward_redemptions r
  left join public.profiles p on p.id = r.user_id
  where r.code = upper(p_code) and r.expires_at > now();

  return result;
end;
$$;

create or replace function public.workshop_redeem_coupon(p_code text, p_type text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  coupon public.reward_redemptions%rowtype;
  customer_name text;
  order_number bigint;
begin
  if coalesce((select private.user_role()), '') not in ('admin', 'kelner') then
    raise exception 'Brak uprawnień do realizacji kuponów.' using errcode = '42501';
  end if;
  if p_type not in ('Odbiór osobisty', 'Stacjonarnie') then
    raise exception 'Nieprawidłowy typ zamówienia.' using errcode = '22023';
  end if;

  -- DELETE ... RETURNING blokuje wiersz: dwóch kasjerów nie zrealizuje tego samego kodu.
  delete from public.reward_redemptions
  where code = upper(p_code) and expires_at > now()
  returning * into coupon;
  if not found then
    return null;
  end if;

  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into customer_name
  from public.profiles where id = coupon.user_id;

  insert into public.orders (type, source, customer, phone, items, note, eta, subtotal, discount, delivery_fee, total, customer_id)
  values (
    p_type,
    'own',
    coalesce(customer_name, 'Klient Yummy Club'),
    '',
    case when jsonb_array_length(coupon.items) > 0 then coupon.items else jsonb_build_array(jsonb_build_object('name', coupon.reward, 'quantity', 1)) end,
    format('Kupon Yummy Club %s · %s (%s pkt)', coupon.code, coupon.reward, coupon.cost),
    case when p_type = 'Stacjonarnie' then 'Na miejscu' else '15 min' end,
    0, 0, 0, 0,
    coupon.user_id
  )
  returning number into order_number;

  return json_build_object('orderNumber', order_number, 'reward', coupon.reward);
end;
$$;

revoke all on function public.workshop_coupon_preview(text) from public, anon;
revoke all on function public.workshop_redeem_coupon(text, text) from public, anon;
grant execute on function public.workshop_coupon_preview(text) to authenticated;
grant execute on function public.workshop_redeem_coupon(text, text) to authenticated;
