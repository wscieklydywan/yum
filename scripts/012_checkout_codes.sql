-- Kupony Yummy Club (6 znaków) i kody promocyjne z zakładki Marketing w koszyku online.
-- Kupon osobisty działa tylko na koncie właściciela. Kod promocyjny w koszyku daje rabat / darmową
-- pozycję bezpośrednio do zamówienia (kody na punkty realizuje się w Yummy Club).

create or replace function private.checkout_code_payload(r public.reward_redemptions)
returns json
language sql
immutable
set search_path = ''
as $$
  select json_build_object(
    'kind', 'coupon',
    'code', r.code,
    'reward', r.reward,
    'items', case
      when r.discount_type is not null then '[]'::jsonb
      when jsonb_array_length(coalesce(r.items, '[]'::jsonb)) > 0 then r.items
      else jsonb_build_array(jsonb_build_object('name', r.reward, 'quantity', 1)) end,
    'discountType', r.discount_type,
    'discountValue', r.discount_value
  );
$$;

create or replace function private.checkout_promo_payload(promo public.promo_codes)
returns json
language sql
immutable
set search_path = ''
as $$
  select json_build_object(
    'kind', 'promo',
    'code', promo.code,
    'reward', 'Kod ' || promo.code || coalesce(nullif(' · ' || promo.description, ' · '), ''),
    'items', case when promo.reward_type = 'free_item'
      then jsonb_build_array(jsonb_build_object('name', coalesce(nullif(promo.product_name, ''), 'Darmowa pozycja'), 'quantity', 1))
      else '[]'::jsonb end,
    'discountType', case promo.reward_type when 'discount_percent' then 'percent' when 'discount_amount' then 'amount' end,
    'discountValue', case when promo.reward_type in ('discount_percent', 'discount_amount') then promo.discount_value end
  );
$$;

create or replace function private.checkout_validate_promo(promo public.promo_codes, uid uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if promo.id is null or not promo.active then
    raise exception 'promo_invalid' using errcode = 'P0001';
  end if;
  if promo.expires_at is not null and promo.expires_at <= now() then
    raise exception 'promo_expired' using errcode = 'P0001';
  end if;
  if promo.max_uses is not null and promo.uses_count >= promo.max_uses then
    raise exception 'promo_exhausted' using errcode = 'P0001';
  end if;
  if (select count(*) from public.promo_code_uses where promo_id = promo.id and user_id = uid) >= promo.per_user_limit then
    raise exception 'promo_already_used' using errcode = 'P0001';
  end if;
  if promo.reward_type = 'points' then
    raise exception 'promo_points_only' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.checkout_code_preview(p_code text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  normalized text := upper(trim(coalesce(p_code, '')));
  coupon public.reward_redemptions%rowtype;
  promo public.promo_codes%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into coupon from public.reward_redemptions
  where code = normalized and user_id = uid and expires_at > now();
  if found then
    return private.checkout_code_payload(coupon);
  end if;

  select * into promo from public.promo_codes where code = normalized;
  perform private.checkout_validate_promo(promo, uid);
  return private.checkout_promo_payload(promo);
end;
$$;

create or replace function public.checkout_claim_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  normalized text := upper(trim(coalesce(p_code, '')));
  coupon public.reward_redemptions%rowtype;
  promo public.promo_codes%rowtype;
  use_id bigint;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  delete from public.reward_redemptions
  where code = normalized and user_id = uid and expires_at > now()
  returning * into coupon;
  if found then
    return (private.checkout_code_payload(coupon)::jsonb || jsonb_build_object('restore', to_jsonb(coupon) - 'id'))::json;
  end if;

  select * into promo from public.promo_codes where code = normalized for update;
  perform private.checkout_validate_promo(promo, uid);

  update public.promo_codes set uses_count = uses_count + 1 where id = promo.id;
  insert into public.promo_code_uses (promo_id, user_id) values (promo.id, uid) returning id into use_id;

  return (private.checkout_promo_payload(promo)::jsonb || jsonb_build_object('restore', jsonb_build_object('promo_id', promo.id, 'use_id', use_id)))::json;
end;
$$;

-- Wywoływane przez API (service role), gdy zapis zamówienia się nie powiedzie.
create or replace function public.checkout_release_code(p_claim json)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  restore jsonb := (p_claim::jsonb) -> 'restore';
begin
  if p_claim ->> 'kind' = 'coupon' then
    insert into public.reward_redemptions
    select * from jsonb_populate_record(null::public.reward_redemptions, restore)
    on conflict do nothing;
  elsif p_claim ->> 'kind' = 'promo' then
    delete from public.promo_code_uses where id = (restore ->> 'use_id')::bigint;
    update public.promo_codes set uses_count = greatest(uses_count - 1, 0) where id = (restore ->> 'promo_id')::uuid;
  end if;
end;
$$;

revoke all on function public.checkout_code_preview(text) from public, anon;
grant execute on function public.checkout_code_preview(text) to authenticated;
revoke all on function public.checkout_claim_code(text) from public, anon;
grant execute on function public.checkout_claim_code(text) to authenticated;
revoke all on function public.checkout_release_code(json) from public, anon, authenticated;
grant execute on function public.checkout_release_code(json) to service_role;
