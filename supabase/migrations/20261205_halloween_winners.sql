-- Halloween: rozstrzygnięcie „Dyniowych Łowów” po końcu wydarzenia.
-- halloween_finalize() jest idempotentna: zapisuje top 3, dopisuje Stars i tworzy kupony z nagrodą (kod do wpisania przy ladzie).

alter table public.halloween_settings add column if not exists finalized_at timestamptz;

create table if not exists public.halloween_winners (
  place smallint primary key check (place between 1 and 3),
  user_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null,
  prize text not null,
  stars integer not null,
  code text not null unique,
  expires_at timestamptz not null,
  awarded_at timestamptz not null default now(),
  email_sent_at timestamptz,
  email_error text
);
alter table public.halloween_winners enable row level security;
-- Brak polityk: klient czyta przez halloween_results(), warsztat przez klucz serwisowy.

create or replace function private.halloween_display_name(full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(split_part(trim(full_name), ' ', 1) ||
      case when position(' ' in trim(full_name)) > 0
        then ' ' || upper(left(trim(regexp_replace(trim(full_name), '^\S+\s+', '')), 1)) || '.'
        else '' end), ''),
    'Gracz'
  );
$$;

create or replace function public.halloween_finalize()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings record;
  winner record;
  prize record;
  new_code text;
  valid_until timestamptz := now() + interval '30 days';
  created integer := 0;
begin
  select ends_at, finalized_at into settings from public.halloween_settings where id = 1 for update;
  if not found or now() < settings.ends_at then
    return json_build_object('finalized', false, 'created', 0);
  end if;
  if settings.finalized_at is not null then
    return json_build_object('finalized', true, 'created', 0);
  end if;

  for winner in
    with best as (
      select distinct on (g.user_id) g.user_id, g.score, g.finished_at
      from public.halloween_games g
      where g.finished_at is not null and not g.flagged and g.score > 0
      order by g.user_id, g.score desc, g.finished_at asc
    )
    select user_id, score, row_number() over (order by score desc, finished_at asc) as place
    from best
    order by place
    limit 3
  loop
    select * into prize from (values
      (1, 'Halloween 1. miejsce: Zestaw dla dwóch', 500,
        '[{"name":"SERTASTIC","quantity":2},{"name":"FRYTKI CIENKIE","quantity":2},{"name":"Napój 0,5 l","quantity":2}]'::jsonb),
      (2, 'Halloween 2. miejsce: Burger SERTASTIC', 300, '[{"name":"SERTASTIC","quantity":1}]'::jsonb),
      (3, 'Halloween 3. miejsce: Frytki i napój', 150,
        '[{"name":"FRYTKI CIENKIE","quantity":1},{"name":"Napój 0,5 l","quantity":1}]'::jsonb)
    ) as p(place, name, stars, items)
    where p.place = winner.place;

    loop
      new_code := 'DYNIA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
      exit when not exists (select 1 from public.reward_redemptions where code = new_code)
        and not exists (select 1 from public.halloween_winners where code = new_code);
    end loop;

    insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
    values (winner.user_id, prize.name, 0, new_code, prize.items, valid_until);

    update public.profiles set points = points + prize.stars where id = winner.user_id;
    insert into public.point_transactions (user_id, amount, kind, note)
    values (winner.user_id, prize.stars, 'game', 'Halloween: ' || winner.place || '. miejsce');

    insert into public.halloween_winners (place, user_id, score, prize, stars, code, expires_at)
    values (winner.place, winner.user_id, winner.score, prize.name, prize.stars, new_code, valid_until);
    created := created + 1;
  end loop;

  update public.halloween_settings set finalized_at = now() where id = 1;
  return json_build_object('finalized', true, 'created', created);
end;
$$;

-- Wyniki dla zalogowanego klienta: podium + jego własna nagroda z kodem.
create or replace function public.halloween_results()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'ended', now() >= s.ends_at,
    'finalized', s.finalized_at is not null,
    'ends_at', s.ends_at,
    'winners', coalesce((
      select json_agg(json_build_object(
        'place', w.place,
        'name', private.halloween_display_name(p.full_name),
        'score', w.score,
        'prize', w.prize,
        'me', w.user_id = auth.uid()
      ) order by w.place)
      from public.halloween_winners w join public.profiles p on p.id = w.user_id
    ), '[]'::json),
    'mine', (
      select json_build_object(
        'place', w.place,
        'prize', w.prize,
        'stars', w.stars,
        'code', w.code,
        'expires_at', w.expires_at,
        'redeemed', exists (select 1 from public.reward_redemptions r where r.code = w.code),
        'expired', w.expires_at <= now()
      )
      from public.halloween_winners w
      where w.user_id = auth.uid()
    )
  )
  from public.halloween_settings s
  where s.id = 1;
$$;

revoke all on function public.halloween_finalize() from public, anon, authenticated;
grant execute on function public.halloween_finalize() to service_role;
revoke all on function public.halloween_results() from public, anon;
grant execute on function public.halloween_results() to authenticated;
