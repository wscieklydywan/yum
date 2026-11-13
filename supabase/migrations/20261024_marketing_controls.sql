-- Panel sterowania marketingiem: ustawienia koła, koszty nagród, budżety i dziennik kosztów.

alter table public.restaurant_settings
  add column if not exists wheel_enabled boolean not null default true,
  add column if not exists extra_spin_enabled boolean not null default true,
  add column if not exists extra_spin_cost integer not null default 50 check (extra_spin_cost between 1 and 100000),
  add column if not exists wheel_monthly_budget numeric(10,2) check (wheel_monthly_budget is null or wheel_monthly_budget >= 0);

alter table public.wheel_prizes
  add column if not exists cost_value numeric(10,2) not null default 0 check (cost_value >= 0);

alter table public.promo_codes
  add column if not exists cost_value numeric(10,2) not null default 0 check (cost_value >= 0),
  add column if not exists budget numeric(10,2) check (budget is null or budget >= 0);

create table if not exists public.marketing_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('wheel', 'promo')),
  ref_id text,
  label text not null default '',
  amount numeric(10,2) not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists marketing_events_source_created_idx on public.marketing_events (source, created_at desc);
create index if not exists marketing_events_ref_idx on public.marketing_events (source, ref_id);
alter table public.marketing_events enable row level security;
-- Brak polityk: dziennik czyta tylko panel warsztatu przez klucz serwisowy.

create or replace function private.wheel_month_spent()
returns numeric
language sql
stable
set search_path to ''
as $$
  select coalesce(sum(amount), 0) from public.marketing_events
  where source = 'wheel'
    and created_at >= (date_trunc('month', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw');
$$;

create or replace function public.spin_wheel(use_points boolean default false)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  settings public.restaurant_settings%rowtype;
  current_points integer;
  last_free timestamptz;
  today date := (now() at time zone 'Europe/Warsaw')::date;
  is_free boolean;
  cost integer := 0;
  budget numeric;
  spent numeric;
  total_chance numeric;
  roll numeric;
  picked public.wheel_prizes%rowtype;
  picked_index integer;
  gained integer := 0;
  new_points integer;
  new_code text;
  new_expires timestamptz;
  coupon_items jsonb := '[]'::jsonb;
  coupon_discount_type text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into settings from public.restaurant_settings where id = 1;
  if found and not settings.wheel_enabled then
    raise exception 'wheel_disabled' using errcode = 'P0001';
  end if;

  select points, last_free_spin_at into current_points, last_free
  from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  is_free := last_free is null or (last_free at time zone 'Europe/Warsaw')::date < today;
  if not is_free then
    if not use_points then
      raise exception 'free_spin_used' using errcode = 'P0001';
    end if;
    if not coalesce(settings.extra_spin_enabled, true) then
      raise exception 'extra_spin_disabled' using errcode = 'P0001';
    end if;
    cost := coalesce(settings.extra_spin_cost, 50);
    if current_points < cost then
      raise exception 'not_enough_points' using errcode = 'P0001';
    end if;
  end if;

  -- Po wyczerpaniu miesięcznego budżetu losowane są tylko nagrody, które nie kosztują lokalu.
  budget := settings.wheel_monthly_budget;
  spent := case when budget is null then 0 else private.wheel_month_spent() end;

  select coalesce(sum(chance), 0) into total_chance from public.wheel_prizes
  where active and chance > 0 and (budget is null or cost_value = 0 or spent + cost_value <= budget);
  if total_chance <= 0 then
    raise exception 'wheel_unavailable' using errcode = 'P0001';
  end if;

  roll := random()::numeric * total_chance;
  select p.* into picked
  from (
    select w.*, sum(w.chance) over (order by w.sort, w.id) as running
    from public.wheel_prizes w
    where w.active and w.chance > 0 and (budget is null or w.cost_value = 0 or spent + w.cost_value <= budget)
  ) p
  where p.running > roll
  order by p.sort, p.id
  limit 1;
  if picked.id is null then
    select w.* into picked from public.wheel_prizes w
    where w.active and w.chance > 0 and (budget is null or w.cost_value = 0 or spent + w.cost_value <= budget)
    order by w.sort desc, w.id desc limit 1;
  end if;

  select idx - 1 into picked_index from (
    select id, row_number() over (order by sort, id) as idx from public.wheel_prizes where active
  ) ordered where ordered.id = picked.id;

  if picked.reward_type = 'points' then
    gained := picked.points;
  end if;

  update public.profiles
  set points = points - cost + gained,
      last_free_spin_at = case when is_free then now() else last_free_spin_at end
  where id = uid
  returning points into new_points;

  if cost > 0 then
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, -cost, 'spin_cost', 'Dodatkowe zakręcenie');
  end if;
  if gained > 0 then
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, gained, 'spin', 'Koło fortuny · ' || picked.label);
  end if;

  insert into public.marketing_events (source, ref_id, label, amount, user_id)
  values ('wheel', picked.id::text, picked.label, picked.cost_value, uid);

  if picked.reward_type in ('free_item', 'discount_percent', 'discount_amount') then
    delete from public.reward_redemptions where expires_at <= now();
    loop
      new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.reward_redemptions where code = new_code);
    end loop;
    new_expires := now() + make_interval(hours => picked.coupon_hours);
    if picked.reward_type = 'free_item' then
      coupon_items := jsonb_build_array(jsonb_build_object('name', coalesce(nullif(picked.product_name, ''), picked.label), 'quantity', 1));
    else
      coupon_discount_type := case when picked.reward_type = 'discount_percent' then 'percent' else 'amount' end;
    end if;
    insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at, discount_type, discount_value)
    values (
      uid,
      'Koło fortuny · ' || picked.label,
      0, new_code, coupon_items, new_expires,
      coupon_discount_type,
      case when coupon_discount_type is null then null else picked.discount_value end
    );
  end if;

  return json_build_object(
    'segment', picked_index,
    'prizeId', picked.id,
    'type', picked.reward_type,
    'label', picked.label,
    'prize', gained,
    'productName', picked.product_name,
    'discountValue', picked.discount_value,
    'code', new_code,
    'expiresAt', new_expires,
    'points', new_points,
    'free', is_free,
    'cost', cost
  );
end;
$function$;

create or replace function public.redeem_promo_code(p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  promo public.promo_codes%rowtype;
  used_by_user integer;
  promo_spent numeric;
  new_points integer;
  new_code text;
  new_expires timestamptz;
  coupon_items jsonb := '[]'::jsonb;
  coupon_discount_type text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
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
  if promo.budget is not null and promo.cost_value > 0 then
    select coalesce(sum(amount), 0) into promo_spent from public.marketing_events where source = 'promo' and ref_id = promo.id::text;
    if promo_spent + promo.cost_value > promo.budget then
      raise exception 'promo_exhausted' using errcode = 'P0001';
    end if;
  end if;
  select count(*) into used_by_user from public.promo_code_uses where promo_id = promo.id and user_id = uid;
  if used_by_user >= promo.per_user_limit then
    raise exception 'promo_already_used' using errcode = 'P0001';
  end if;
  update public.promo_codes set uses_count = uses_count + 1 where id = promo.id;
  insert into public.promo_code_uses (promo_id, user_id) values (promo.id, uid);
  insert into public.marketing_events (source, ref_id, label, amount, user_id)
  values ('promo', promo.id::text, promo.code, promo.cost_value, uid);
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
$function$;
