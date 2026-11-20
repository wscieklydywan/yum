-- Kalendarz adwentowy: ustawienia (wyłączony / zapowiedź / włączony), 24 okienka z nagrodami i otwarcia klientów.
-- Klient otwiera okienko przez advent_open(); baza pilnuje dnia, trybu i jednego otwarcia na okienko.

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind in ('spin', 'spin_cost', 'staff', 'redeem', 'promo', 'purchase', 'refund', 'game', 'advent'));

create table if not exists public.advent_settings (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'teaser' check (mode in ('off', 'teaser', 'live')),
  starts_on date not null default date '2026-12-01',
  days smallint not null default 24 check (days between 1 and 31),
  allow_late boolean not null default false,
  coupon_valid_days integer not null default 7 check (coupon_valid_days between 1 and 60),
  teaser_text text not null default '' check (char_length(teaser_text) <= 200),
  show_home_slide boolean not null default true,
  show_bubble boolean not null default true,
  show_club_banner boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.advent_settings enable row level security;
-- Brak polityk: klient czyta przez advent_calendar(), warsztat przez klucz serwisowy.

insert into public.advent_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.advent_days (
  day smallint primary key check (day between 1 and 31),
  kind text not null default 'stars' check (kind in ('stars', 'food', 'discount', 'none')),
  title text not null default '' check (char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 200),
  stars integer not null default 0 check (stars between 0 and 1000),
  items jsonb not null default '[]'::jsonb,
  discount_type text check (discount_type in ('percent', 'amount')),
  discount_value numeric check (discount_value is null or discount_value > 0),
  updated_at timestamptz not null default now()
);
alter table public.advent_days enable row level security;

insert into public.advent_days (day, kind, title, description, stars, items, discount_type, discount_value)
select d,
  case when d in (6, 13, 20, 24) then 'food' when d in (4, 11, 18) then 'discount' else 'stars' end,
  case
    when d = 6 then 'Mikołajkowe frytki gratis'
    when d = 13 then 'Napój gratis'
    when d = 20 then 'Krążki cebulowe gratis'
    when d = 24 then 'Świąteczny burger gratis'
    when d in (4, 11, 18) then '10% rabatu na zamówienie'
    else (case when d % 5 = 0 then 15 else 5 end) || ' Stars na start dnia'
  end,
  case
    when d in (6, 13, 20, 24) then 'Pokaż kod przy ladzie albo wpisz go w zamówieniu.'
    when d in (4, 11, 18) then 'Jednorazowy rabat – wpisz kod w zamówieniu.'
    else 'Stars trafiły od razu na Twoje konto.'
  end,
  case when d in (4, 6, 11, 13, 18, 20, 24) then 0 when d % 5 = 0 then 15 else 5 end,
  case
    when d = 6 then '[{"name":"FRYTKI CIENKIE","quantity":1}]'::jsonb
    when d = 13 then '[{"name":"Napój 0,5 l","quantity":1}]'::jsonb
    when d = 20 then '[{"name":"KRĄŻKI CEBULOWE","quantity":1}]'::jsonb
    when d = 24 then '[{"name":"Burger Classic","quantity":1}]'::jsonb
    else '[]'::jsonb
  end,
  case when d in (4, 11, 18) then 'percent' end,
  case when d in (4, 11, 18) then 10 end
from generate_series(1, 31) as d
on conflict (day) do nothing;

create table if not exists public.advent_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day smallint not null,
  claimed_at timestamptz not null default now(),
  kind text not null,
  title text not null,
  stars integer not null default 0,
  code text,
  primary key (user_id, day)
);
create index if not exists advent_claims_day_idx on public.advent_claims (day);
alter table public.advent_claims enable row level security;

drop policy if exists advent_claims_select_own on public.advent_claims;
create policy advent_claims_select_own on public.advent_claims
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Numer dzisiejszego okienka (1 = dzień startu, czas polski). Może być <= 0 (przed startem) lub > days (po końcu).
create or replace function private.advent_today(p_starts_on date)
returns integer
language sql
stable
set search_path = ''
as $$
  select ((now() at time zone 'Europe/Warsaw')::date - p_starts_on) + 1;
$$;

-- Stan kalendarza dla strony i Yummy Club. Treść okienek jest ujawniana dopiero, gdy okienko można otworzyć.
create or replace function public.advent_calendar()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
  uid uuid := auth.uid();
  today integer;
begin
  select * into s from public.advent_settings where id = 1;
  if not found then
    return json_build_object('mode', 'off');
  end if;
  today := private.advent_today(s.starts_on);

  return json_build_object(
    'mode', s.mode,
    'starts_on', s.starts_on,
    'days', s.days,
    'today', today,
    'started', s.mode = 'live' and today >= 1,
    'ended', s.mode = 'live' and today > s.days,
    'allow_late', s.allow_late,
    'teaser_text', s.teaser_text,
    'show_home_slide', s.show_home_slide,
    'show_bubble', s.show_bubble,
    'show_club_banner', s.show_club_banner,
    'logged_in', uid is not null,
    'windows', (
      select coalesce(json_agg(json_build_object(
        'day', d.day,
        'openable', s.mode = 'live' and c.day is null and d.day <= today and today <= s.days
          and (d.day = today or s.allow_late),
        'missed', s.mode = 'live' and c.day is null and d.day < today and not s.allow_late,
        'claimed', c.day is not null,
        'title', c.title,
        'kind', c.kind,
        'stars', c.stars,
        'code', c.code
      ) order by d.day), '[]'::json)
      from public.advent_days d
      left join public.advent_claims c on c.day = d.day and c.user_id = uid
      where d.day <= s.days
    )
  );
end;
$$;

create or replace function public.advent_open(p_day integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s record;
  d record;
  today integer;
  new_code text;
  new_points integer;
  reward_name text;
  valid_until timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into s from public.advent_settings where id = 1;
  if not found or s.mode <> 'live' then
    raise exception 'advent_inactive' using errcode = 'P0001';
  end if;

  today := private.advent_today(s.starts_on);
  if p_day is null or p_day < 1 or p_day > s.days or p_day > today or today > s.days then
    raise exception 'window_locked' using errcode = 'P0001';
  end if;
  if p_day < today and not s.allow_late then
    raise exception 'window_missed' using errcode = 'P0001';
  end if;

  perform 1 from public.profiles where id = uid and role = 'klient' for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.advent_claims where user_id = uid and day = p_day) then
    raise exception 'already_opened' using errcode = 'P0001';
  end if;

  select * into d from public.advent_days where day = p_day;
  if not found then
    raise exception 'window_locked' using errcode = 'P0001';
  end if;

  reward_name := coalesce(nullif(trim(d.title), ''), 'Niespodzianka');

  if d.kind = 'stars' and d.stars > 0 then
    update public.profiles set points = points + d.stars where id = uid returning points into new_points;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, d.stars, 'advent', 'Kalendarz adwentowy · ' || p_day || ' grudnia');
  elsif d.kind in ('food', 'discount') then
    loop
      new_code := 'ADW-' || upper(substr(md5(gen_random_uuid()::text), 1, 5));
      exit when not exists (select 1 from public.reward_redemptions where code = new_code);
    end loop;
    valid_until := now() + make_interval(days => s.coupon_valid_days);
    insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at, discount_type, discount_value)
    values (
      uid,
      'Kalendarz adwentowy: ' || reward_name,
      0,
      new_code,
      case when d.kind = 'food' then d.items else '[]'::jsonb end,
      valid_until,
      case when d.kind = 'discount' then d.discount_type end,
      case when d.kind = 'discount' then d.discount_value end
    );
  end if;

  insert into public.advent_claims (user_id, day, kind, title, stars, code)
  values (uid, p_day, d.kind, reward_name, case when d.kind = 'stars' then d.stars else 0 end, new_code);

  if new_points is null then
    select points into new_points from public.profiles where id = uid;
  end if;

  return json_build_object(
    'day', p_day,
    'kind', d.kind,
    'title', reward_name,
    'description', d.description,
    'stars', case when d.kind = 'stars' then d.stars else 0 end,
    'code', new_code,
    'expires_at', valid_until,
    'points', new_points
  );
end;
$$;

-- Statystyki dla warsztatu: otwarcia na dzień, rozdane Stars i wykorzystane kupony.
create or replace function public.advent_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'opens', (select count(*) from public.advent_claims),
    'players', (select count(distinct user_id) from public.advent_claims),
    'stars', (select coalesce(sum(stars), 0) from public.advent_claims),
    'coupons', (select count(*) from public.advent_claims where code is not null),
    'coupons_used', (
      select count(*) from public.advent_claims c
      join public.reward_redemptions r on r.code = c.code
      where r.status = 'used'
    ),
    'per_day', coalesce((
      select json_object_agg(day, total) from (
        select day, count(*) as total from public.advent_claims group by day
      ) t
    ), '{}'::json)
  );
$$;

revoke all on function public.advent_calendar() from public;
grant execute on function public.advent_calendar() to anon, authenticated, service_role;
revoke all on function public.advent_open(integer) from public, anon;
grant execute on function public.advent_open(integer) to authenticated;
revoke all on function public.advent_stats() from public, anon, authenticated;
grant execute on function public.advent_stats() to service_role;
