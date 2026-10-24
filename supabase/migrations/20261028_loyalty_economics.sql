-- Ekonomia programu lojalnościowego: edytowalny katalog „Wydaj Stars”, edytowalne parametry Halloween
-- i koszt surowca (food cost) używany do szacowania, ile lokal faktycznie płaci za nagrody.

alter table public.restaurant_settings
  add column if not exists food_cost_percent numeric(5,2) not null default 30
    check (food_cost_percent >= 0 and food_cost_percent <= 100);

alter table public.marketing_events drop constraint if exists marketing_events_source_check;
alter table public.marketing_events add constraint marketing_events_source_check
  check (source in ('wheel', 'promo', 'reward'));

-- Katalog nagród --------------------------------------------------------------

create table if not exists public.loyalty_rewards (
  key text primary key check (key ~ '^[a-z0-9_-]{2,32}$'),
  name text not null check (char_length(name) between 1 and 80),
  note text not null default '' check (char_length(note) <= 120),
  cost integer not null check (cost between 1 and 100000),
  menu_value numeric(10,2) not null default 0 check (menu_value >= 0),
  items jsonb not null default '[]'::jsonb,
  image text not null default '',
  active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.loyalty_rewards enable row level security;
drop policy if exists loyalty_rewards_public_read on public.loyalty_rewards;
create policy loyalty_rewards_public_read on public.loyalty_rewards
  for select to anon, authenticated
  using (active);
grant select on public.loyalty_rewards to anon, authenticated;

insert into public.loyalty_rewards (key, name, note, cost, menu_value, items, image, sort) values
  ('sauce', 'Sos do wyboru', 'Do każdego zamówienia', 15, 2, '[{"name":"Sos do wyboru","quantity":1}]', '/images/ingredient-sauce.webp', 10),
  ('double', 'Upgrade na DOUBLE', 'Do burgera z zamówienia', 40, 6, '[{"name":"Upgrade na DOUBLE","quantity":1}]', '/images/bbq-bacon.webp', 20),
  ('drink', 'Napój 0,5 l', 'Pepsi, 7UP, Mirinda lub woda', 50, 8.5, '[{"name":"Napój 0,5 l","quantity":1}]', '/images/cola.webp', 30),
  ('fries', 'Frytki cienkie', 'Porcja frytek', 70, 12.99, '[{"name":"FRYTKI CIENKIE","quantity":1}]', '/images/fries.webp', 40),
  ('rings', 'Krążki cebulowe', 'Chrupiąca porcja', 90, 14.99, '[{"name":"KRĄŻKI CEBULOWE","quantity":1}]', '/images/onion-rings.webp', 50),
  ('nuggets', 'Nuggetsy', 'Porcja nuggetsów', 100, 15.99, '[{"name":"NUGGETSY","quantity":1}]', '/images/nuggets.webp', 60),
  ('burger', 'Burger SERTASTIC', 'Wersja SINGLE', 300, 31.99, '[{"name":"SERTASTIC","quantity":1}]', '/images/classic.webp', 70),
  ('combo', 'Zestaw SERTASTIC', 'Burger + frytki + napój', 450, 53.48, '[{"name":"SERTASTIC","quantity":1},{"name":"FRYTKI CIENKIE","quantity":1},{"name":"Napój 0,5 l","quantity":1}]', '/images/combo.webp', 80)
on conflict (key) do nothing;

create or replace function public.redeem_reward(reward_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  reward public.loyalty_rewards%rowtype;
  food_cost numeric;
  current_points integer;
  new_points integer;
  new_code text;
  new_id bigint;
  new_expires timestamptz := now() + interval '24 hours';
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into reward from public.loyalty_rewards where key = reward_key and active;
  if not found then
    raise exception 'unknown_reward' using errcode = '22023';
  end if;

  select points into current_points from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if current_points < reward.cost then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;

  delete from public.reward_redemptions where expires_at <= now();

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.reward_redemptions where code = new_code);
  end loop;

  update public.profiles set points = points - reward.cost where id = uid returning points into new_points;

  insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
  values (uid, reward.name, reward.cost, new_code, reward.items, new_expires)
  returning id into new_id;
  insert into public.point_transactions (user_id, amount, kind, note)
  values (uid, -reward.cost, 'redeem', reward.name);

  select coalesce(food_cost_percent, 30) into food_cost from public.restaurant_settings where id = 1;
  insert into public.marketing_events (source, ref_id, label, amount, user_id)
  values ('reward', reward.key, reward.name, round(reward.menu_value * coalesce(food_cost, 30) / 100, 2), uid);

  return json_build_object(
    'id', new_id,
    'code', new_code, 'points', new_points, 'reward', reward.name, 'cost', reward.cost,
    'items', reward.items, 'expires_at', new_expires
  );
end;
$$;
revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;

-- Halloween -------------------------------------------------------------------

create table if not exists public.halloween_settings (
  id integer primary key default 1 check (id = 1),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  daily_games integer not null check (daily_games between 1 and 50),
  points_per_star integer not null check (points_per_star between 1 and 100000),
  max_stars_per_game integer not null check (max_stars_per_game between 0 and 1000),
  daily_star_cap integer not null check (daily_star_cap between 0 and 10000),
  max_score_per_second integer not null default 80 check (max_score_per_second between 1 and 10000),
  min_seconds integer not null default 5 check (min_seconds >= 1),
  max_seconds integer not null default 900 check (max_seconds >= min_seconds),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.halloween_settings enable row level security;
-- Brak polityk: ustawienia czyta baza (funkcje security definer) i panel warsztatu przez klucz serwisowy.

insert into public.halloween_settings (id, starts_at, ends_at, daily_games, points_per_star, max_stars_per_game, daily_star_cap)
values (1, '2026-10-13 00:00:00+02', '2026-11-02 00:00:00+01', 5, 150, 10, 25)
on conflict (id) do nothing;

create or replace function private.halloween_config()
returns json
language sql
stable
set search_path = ''
as $$
  select json_build_object(
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'daily_games', s.daily_games,
    'points_per_star', s.points_per_star,
    'max_stars_per_game', s.max_stars_per_game,
    'daily_star_cap', s.daily_star_cap,
    'max_score_per_second', s.max_score_per_second,
    'min_seconds', s.min_seconds,
    'max_seconds', s.max_seconds
  )
  from public.halloween_settings s
  where s.id = 1;
$$;

create or replace function public.halloween_stats(p_from timestamptz)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'games', count(*) filter (where finished_at is not null),
    'players', count(distinct user_id),
    'stars', coalesce(sum(stars), 0),
    'flagged', count(*) filter (where flagged),
    'today_games', count(*) filter (where started_at >= p_from),
    'today_stars', coalesce(sum(stars) filter (where started_at >= p_from), 0)
  )
  from public.halloween_games;
$$;
revoke all on function public.halloween_stats(timestamptz) from public, anon, authenticated;
grant execute on function public.halloween_stats(timestamptz) to service_role;
