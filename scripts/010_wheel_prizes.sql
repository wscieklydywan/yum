-- Koło fortuny konfigurowane w warsztacie: nagrody (punkty, darmowa pozycja, rabat), szanse z dokładnością 0,001%.

create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  sort integer not null default 0,
  label text not null check (char_length(label) between 1 and 24),
  description text not null default '' check (char_length(description) <= 80),
  reward_type text not null check (reward_type in ('points', 'free_item', 'discount_percent', 'discount_amount', 'nothing')),
  points integer not null default 0 check (points between 0 and 100000),
  product_id text references public.menu_products (id) on delete set null,
  product_name text not null default '' check (char_length(product_name) <= 120),
  discount_value numeric(10, 2) not null default 0 check (discount_value >= 0 and discount_value <= 1000),
  coupon_hours integer not null default 24 check (coupon_hours between 1 and 720),
  chance numeric(7, 3) not null default 0 check (chance >= 0 and chance <= 100),
  visual text not null default 'icon' check (visual in ('image', 'icon')),
  image text not null default '' check (char_length(image) <= 500),
  icon text not null default 'gift' check (char_length(icon) <= 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wheel_prizes_active_sort_idx on public.wheel_prizes (active, sort, id);

alter table public.wheel_prizes enable row level security;

-- Klienci widzą tylko aktywne pola (bez zapisu). Zapisy wyłącznie przez API warsztatu (service role).
drop policy if exists wheel_prizes_select_active on public.wheel_prizes;
create policy wheel_prizes_select_active on public.wheel_prizes
  for select to anon, authenticated
  using (active);

-- Obecne 6 pól koła z dotychczasowymi szansami (30 / 25 / 20 / 15 / 7 / 3 %).
insert into public.wheel_prizes (sort, label, description, reward_type, points, chance, visual, image, icon)
select * from (values
  (0, 'Burger', 'Burger klasyczny', 'points', 150, 7.000, 'image', '/images/classic.webp', 'gift'),
  (1, 'Frytki', 'Porcja frytek', 'points', 30, 20.000, 'image', '/images/fries.webp', 'gift'),
  (2, 'Korona', 'Główna nagroda', 'points', 300, 3.000, 'icon', '', 'crown'),
  (3, 'Napój', 'Napój 0,5 l', 'points', 20, 25.000, 'image', '/images/cola.webp', 'gift'),
  (4, 'Prezent', 'Niespodzianka od Yummy', 'points', 50, 15.000, 'icon', '', 'gift'),
  (5, 'Kupon', 'Drobny bonus', 'points', 10, 30.000, 'icon', '', 'tag')
) as seed(sort, label, description, reward_type, points, chance, visual, image, icon)
where not exists (select 1 from public.wheel_prizes);

-- Kupony z koła: koszt 0 pkt, opcjonalny rabat.
alter table public.reward_redemptions drop constraint if exists reward_redemptions_cost_check;
alter table public.reward_redemptions add constraint reward_redemptions_cost_check check (cost >= 0);
alter table public.reward_redemptions
  add column if not exists discount_type text check (discount_type in ('percent', 'amount')),
  add column if not exists discount_value numeric(10, 2);

create or replace function public.spin_wheel(use_points boolean default false)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_points integer;
  last_free timestamptz;
  today date := (now() at time zone 'Europe/Warsaw')::date;
  is_free boolean;
  cost integer := 0;
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
    if current_points < 50 then
      raise exception 'not_enough_points' using errcode = 'P0001';
    end if;
    cost := 50;
  end if;

  select coalesce(sum(chance), 0) into total_chance from public.wheel_prizes where active;
  if total_chance <= 0 then
    raise exception 'wheel_unavailable' using errcode = 'P0001';
  end if;

  -- Losowanie ważone: szanse są przeliczane proporcjonalnie do ich sumy.
  roll := random()::numeric * total_chance;
  select p.* into picked
  from (
    select w.*, sum(w.chance) over (order by w.sort, w.id) as running
    from public.wheel_prizes w where w.active and w.chance > 0
  ) p
  where p.running > roll
  order by p.sort, p.id
  limit 1;
  if picked.id is null then
    select w.* into picked from public.wheel_prizes w where w.active and w.chance > 0 order by w.sort desc, w.id desc limit 1;
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
    'free', is_free
  );
end;
$$;

revoke all on function public.spin_wheel(boolean) from public, anon;
grant execute on function public.spin_wheel(boolean) to authenticated;

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
  if coalesce((select private.user_role()), '') not in ('admin', 'szef', 'kelner') then
    raise exception 'Brak uprawnień do realizacji kuponów.' using errcode = '42501';
  end if;

  select json_build_object(
    'code', r.code,
    'reward', r.reward,
    'items', case
      when r.discount_type is not null then '[]'::jsonb
      when jsonb_array_length(r.items) > 0 then r.items
      else jsonb_build_array(jsonb_build_object('name', r.reward, 'quantity', 1)) end,
    'discountType', r.discount_type,
    'discountValue', r.discount_value,
    'expiresAt', r.expires_at,
    'customer', coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Klient Yummy Club')
  ) into result
  from public.reward_redemptions r
  left join public.profiles p on p.id = r.user_id
  where r.code = upper(p_code) and r.expires_at > now();

  return result;
end;
$$;

-- Kupon rabatowy nie tworzy zamówienia: kod jest kasowany, a rabat udziela kasjer przy zamówieniu.
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
  if coalesce((select private.user_role()), '') not in ('admin', 'szef', 'kelner') then
    raise exception 'Brak uprawnień do realizacji kuponów.' using errcode = '42501';
  end if;
  if p_type not in ('Odbiór osobisty', 'Stacjonarnie') then
    raise exception 'Nieprawidłowy typ zamówienia.' using errcode = '22023';
  end if;

  delete from public.reward_redemptions
  where code = upper(p_code) and expires_at > now()
  returning * into coupon;
  if not found then
    return null;
  end if;

  if coupon.discount_type is not null then
    return json_build_object('reward', coupon.reward, 'discountType', coupon.discount_type, 'discountValue', coupon.discount_value);
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
    case when coupon.cost > 0
      then format('Kupon Yummy Club %s · %s (%s pkt)', coupon.code, coupon.reward, coupon.cost)
      else format('Kupon Yummy Club %s · %s', coupon.code, coupon.reward) end,
    case when p_type = 'Stacjonarnie' then 'Na miejscu' else '15 min' end,
    0, 0, 0, 0,
    coupon.user_id
  )
  returning number into order_number;

  return json_build_object('orderNumber', order_number, 'reward', coupon.reward);
end;
$$;
