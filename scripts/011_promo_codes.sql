-- Kody promocyjne tworzone w warsztacie (zakładka Marketing).
-- Klient wpisuje kod w Yummy Club: punkty trafiają od razu na konto, a darmowa pozycja / rabat
-- tworzy osobisty kupon (reward_redemptions) realizowany przy ladzie.

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{3,24}$'),
  description text not null default '' check (char_length(description) <= 120),
  reward_type text not null check (reward_type in ('points', 'free_item', 'discount_percent', 'discount_amount')),
  points integer not null default 0 check (points between 0 and 100000),
  product_id text references public.menu_products (id) on delete set null,
  product_name text not null default '' check (char_length(product_name) <= 120),
  discount_value numeric(10, 2) not null default 0 check (discount_value >= 0 and discount_value <= 1000),
  coupon_hours integer not null default 24 check (coupon_hours between 1 and 720),
  max_uses integer check (max_uses is null or max_uses between 1 and 1000000),
  per_user_limit integer not null default 1 check (per_user_limit between 1 and 100),
  uses_count integer not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promo_code_uses (
  id bigint generated always as identity primary key,
  promo_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists promo_code_uses_promo_user_idx on public.promo_code_uses (promo_id, user_id);

-- Brak polityk = brak dostępu dla anon/authenticated. Zarządzanie przez API warsztatu (service role),
-- realizacja przez funkcję redeem_promo_code (security definer).
alter table public.promo_codes enable row level security;
alter table public.promo_code_uses enable row level security;

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind in ('spin', 'spin_cost', 'staff', 'redeem', 'promo'));

create or replace function public.redeem_promo_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  promo public.promo_codes%rowtype;
  used_by_user integer;
  new_points integer;
  new_code text;
  new_expires timestamptz;
  coupon_items jsonb := '[]'::jsonb;
  coupon_discount_type text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- FOR UPDATE: równoległe próby nie przekroczą limitu użyć.
  select * into promo from public.promo_codes
  where code = upper(trim(coalesce(p_code, ''))) for update;
  if not found or not promo.active then
    raise exception 'promo_invalid' using errcode = 'P0001';
  end if;
  if promo.expires_at is not null and promo.expires_at <= now() then
    raise exception 'promo_expired' using errcode = 'P0001';
  end if;
  if promo.max_uses is not null and promo.uses_count >= promo.max_uses then
    raise exception 'promo_exhausted' using errcode = 'P0001';
  end if;

  select count(*) into used_by_user from public.promo_code_uses where promo_id = promo.id and user_id = uid;
  if used_by_user >= promo.per_user_limit then
    raise exception 'promo_already_used' using errcode = 'P0001';
  end if;

  update public.promo_codes set uses_count = uses_count + 1 where id = promo.id;
  insert into public.promo_code_uses (promo_id, user_id) values (promo.id, uid);

  if promo.reward_type = 'points' then
    update public.profiles set points = points + promo.points where id = uid returning points into new_points;
    if not found then
      raise exception 'profile_missing' using errcode = 'P0002';
    end if;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, promo.points, 'promo', 'Kod ' || promo.code);
  else
    select points into new_points from public.profiles where id = uid;
    delete from public.reward_redemptions where expires_at <= now();
    loop
      new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.reward_redemptions where code = new_code);
    end loop;
    new_expires := now() + make_interval(hours => promo.coupon_hours);
    if promo.expires_at is not null and promo.expires_at < new_expires then
      new_expires := promo.expires_at;
    end if;
    if promo.reward_type = 'free_item' then
      coupon_items := jsonb_build_array(jsonb_build_object('name', coalesce(nullif(promo.product_name, ''), 'Darmowa pozycja'), 'quantity', 1));
    else
      coupon_discount_type := case when promo.reward_type = 'discount_percent' then 'percent' else 'amount' end;
    end if;
    insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at, discount_type, discount_value)
    values (
      uid,
      'Kod ' || promo.code || coalesce(nullif(' · ' || promo.description, ' · '), ''),
      0, new_code, coupon_items, new_expires,
      coupon_discount_type,
      case when coupon_discount_type is null then null else promo.discount_value end
    );
  end if;

  return json_build_object(
    'type', promo.reward_type,
    'points', promo.points,
    'productName', promo.product_name,
    'discountValue', promo.discount_value,
    'description', promo.description,
    'code', new_code,
    'expiresAt', new_expires,
    'totalPoints', new_points
  );
end;
$$;

revoke all on function public.redeem_promo_code(text) from public, anon;
grant execute on function public.redeem_promo_code(text) to authenticated;
