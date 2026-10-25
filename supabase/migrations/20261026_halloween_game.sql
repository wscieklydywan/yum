-- Halloween: minigra „Dyniowe Łowy” z rankingiem.
-- Gra startuje i kończy się przez RPC; baza pilnuje limitów, czasu trwania i wiarygodności wyniku.
-- Stars za grę nie liczą się do statusu (status_points) – tylko do profiles.points.

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions add constraint point_transactions_kind_check
  check (kind in ('spin', 'spin_cost', 'staff', 'redeem', 'promo', 'purchase', 'refund', 'game'));

create table if not exists public.halloween_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer,
  stars integer not null default 0,
  flagged boolean not null default false
);

create index if not exists halloween_games_user_started_idx on public.halloween_games (user_id, started_at desc);
create index if not exists halloween_games_score_idx on public.halloween_games (score desc) where finished_at is not null and not flagged;

alter table public.halloween_games enable row level security;

drop policy if exists halloween_games_select_own on public.halloween_games;
create policy halloween_games_select_own on public.halloween_games
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Parametry wydarzenia w jednym miejscu.
create or replace function private.halloween_config()
returns json
language sql
immutable
set search_path = ''
as $$
  select json_build_object(
    'starts_at', '2026-10-13 00:00:00+02'::timestamptz,
    'ends_at', '2026-11-02 00:00:00+01'::timestamptz,
    'daily_games', 5,
    'points_per_star', 150,
    'max_stars_per_game', 10,
    'daily_star_cap', 25,
    'max_score_per_second', 80,
    'min_seconds', 5,
    'max_seconds', 900
  );
$$;

create or replace function public.halloween_state()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cfg json := private.halloween_config();
  today date := (now() at time zone 'Europe/Warsaw')::date;
  played integer := 0;
  stars_today integer := 0;
  best integer := 0;
begin
  if uid is not null then
    select count(*), coalesce(sum(stars), 0) into played, stars_today
    from public.halloween_games
    where user_id = uid and (started_at at time zone 'Europe/Warsaw')::date = today;

    select coalesce(max(score), 0) into best
    from public.halloween_games
    where user_id = uid and finished_at is not null and not flagged;
  end if;

  return json_build_object(
    'active', now() >= (cfg->>'starts_at')::timestamptz and now() < (cfg->>'ends_at')::timestamptz,
    'ends_at', cfg->>'ends_at',
    'games_left', greatest(0, (cfg->>'daily_games')::int - played),
    'daily_games', (cfg->>'daily_games')::int,
    'stars_today', stars_today,
    'daily_star_cap', (cfg->>'daily_star_cap')::int,
    'points_per_star', (cfg->>'points_per_star')::int,
    'max_stars_per_game', (cfg->>'max_stars_per_game')::int,
    'best_score', best
  );
end;
$$;

create or replace function public.halloween_start_game()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cfg json := private.halloween_config();
  today date := (now() at time zone 'Europe/Warsaw')::date;
  played integer;
  game_id uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if now() < (cfg->>'starts_at')::timestamptz or now() >= (cfg->>'ends_at')::timestamptz then
    raise exception 'event_inactive' using errcode = 'P0001';
  end if;

  perform 1 from public.profiles where id = uid and role = 'klient' for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select count(*) into played
  from public.halloween_games
  where user_id = uid and (started_at at time zone 'Europe/Warsaw')::date = today;
  if played >= (cfg->>'daily_games')::int then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  -- Porzucone gry z tego samego dnia też zużywają limit.
  insert into public.halloween_games (user_id) values (uid) returning id into game_id;
  return game_id;
end;
$$;

create or replace function public.halloween_finish_game(p_game uuid, p_score integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cfg json := private.halloween_config();
  game record;
  seconds double precision;
  is_flagged boolean := false;
  today date := (now() at time zone 'Europe/Warsaw')::date;
  stars_today integer;
  awarded integer := 0;
  new_points integer;
  best integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into game from public.halloween_games where id = p_game and user_id = uid for update;
  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if game.finished_at is not null then
    raise exception 'game_finished' using errcode = 'P0001';
  end if;

  seconds := extract(epoch from now() - game.started_at);
  if p_score is null or p_score < 0 or p_score > 100000
     or seconds < (cfg->>'min_seconds')::int
     or seconds > (cfg->>'max_seconds')::int
     or p_score > seconds * (cfg->>'max_score_per_second')::int then
    is_flagged := true;
  end if;

  if not is_flagged then
    select coalesce(sum(stars), 0) into stars_today
    from public.halloween_games
    where user_id = uid and (started_at at time zone 'Europe/Warsaw')::date = today;

    awarded := least(
      p_score / (cfg->>'points_per_star')::int,
      (cfg->>'max_stars_per_game')::int,
      greatest(0, (cfg->>'daily_star_cap')::int - stars_today)
    );
  end if;

  update public.halloween_games
  set finished_at = now(), score = case when is_flagged then 0 else p_score end, stars = awarded, flagged = is_flagged
  where id = p_game;

  if awarded > 0 then
    update public.profiles set points = points + awarded where id = uid returning points into new_points;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, awarded, 'game', 'Dyniowe Łowy · ' || p_score || ' pkt');
  else
    select points into new_points from public.profiles where id = uid;
  end if;

  select coalesce(max(score), 0) into best
  from public.halloween_games where user_id = uid and finished_at is not null and not flagged;

  return json_build_object('stars', awarded, 'points', new_points, 'flagged', is_flagged, 'best_score', best,
    'score', case when is_flagged then 0 else p_score end);
end;
$$;

-- Ranking: najlepszy wynik każdego gracza, imię + inicjał nazwiska.
create or replace function public.halloween_leaderboard()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with best as (
    select distinct on (g.user_id) g.user_id, g.score, g.finished_at
    from public.halloween_games g
    where g.finished_at is not null and not g.flagged and g.score > 0
    order by g.user_id, g.score desc, g.finished_at asc
  ), ranked as (
    select b.user_id, b.score,
      row_number() over (order by b.score desc, b.finished_at asc) as rank,
      coalesce(
        nullif(trim(split_part(trim(p.full_name), ' ', 1) ||
          case when position(' ' in trim(p.full_name)) > 0
            then ' ' || upper(left(trim(regexp_replace(trim(p.full_name), '^\S+\s+', '')), 1)) || '.'
            else '' end), ''),
        'Gracz'
      ) as name
    from best b join public.profiles p on p.id = b.user_id
  )
  select json_build_object(
    'top', coalesce((select json_agg(json_build_object('rank', rank, 'name', name, 'score', score, 'me', user_id = auth.uid()) order by rank)
      from ranked where rank <= 10), '[]'::json),
    'me', (select json_build_object('rank', rank, 'name', name, 'score', score) from ranked where user_id = auth.uid()),
    'players', (select count(*) from ranked)
  );
$$;

revoke all on function public.halloween_state() from public, anon;
revoke all on function public.halloween_start_game() from public, anon;
revoke all on function public.halloween_finish_game(uuid, integer) from public, anon;
revoke all on function public.halloween_leaderboard() from public, anon;
grant execute on function public.halloween_state() to authenticated;
grant execute on function public.halloween_start_game() to authenticated;
grant execute on function public.halloween_finish_game(uuid, integer) to authenticated;
grant execute on function public.halloween_leaderboard() to authenticated;
