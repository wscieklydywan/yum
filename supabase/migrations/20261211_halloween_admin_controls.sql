-- Halloween: nagrody konfigurowane w warsztacie, publiczne wyniki (strona główna) i miejsce każdego gracza.

alter table public.halloween_settings
  add column if not exists prizes jsonb not null default '[
    {"place":1,"title":"Zestaw dla dwóch","short":"Zestaw dla dwóch","items":[{"name":"Burger Classic","quantity":2},{"name":"Frytki duże","quantity":1},{"name":"KRĄŻKI CEBULOWE","quantity":1},{"name":"Napój 0,5 l","quantity":2}]},
    {"place":2,"title":"Burger SERTASTIC gratis","short":"Burger gratis","items":[{"name":"SERTASTIC","quantity":1}]},
    {"place":3,"title":"Frytki i napój gratis","short":"Frytki i napój","items":[{"name":"FRYTKI CIENKIE","quantity":1},{"name":"Napój 0,5 l","quantity":1}]}
  ]'::jsonb,
  add column if not exists runner_up_stars integer not null default 20 check (runner_up_stars between 0 and 1000);

-- Koniec gry: 1 listopada 2026, 23:59:59 czasu polskiego.
update public.halloween_settings
set ends_at = timestamptz '2026-11-01 23:59:59 Europe/Warsaw', updated_at = now()
where id = 1 and finalized_at is null;

create or replace function public.halloween_finalize()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings record;
  winner record;
  prize jsonb;
  prize_name text;
  new_code text;
  valid_until timestamptz := now() + interval '30 days';
  created integer := 0;
begin
  select ends_at, finalized_at, prizes, runner_up_stars into settings from public.halloween_settings where id = 1 for update;
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
    limit 10
  loop
    select p into prize from jsonb_array_elements(settings.prizes) p where (p->>'place')::int = winner.place;

    if winner.place <= 3 and prize is not null then
      prize_name := 'Halloween ' || winner.place || '. miejsce: ' || (prize->>'title');
      loop
        new_code := 'DYNIA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
        exit when not exists (select 1 from public.reward_redemptions where code = new_code)
          and not exists (select 1 from public.halloween_winners where code = new_code);
      end loop;

      insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
      values (winner.user_id, prize_name, 0, new_code, coalesce(prize->'items', '[]'::jsonb), valid_until);

      insert into public.halloween_winners (place, user_id, score, prize, stars, code, expires_at)
      values (winner.place, winner.user_id, winner.score, prize_name, 0, new_code, valid_until);
    elsif winner.place > 3 then
      if settings.runner_up_stars > 0 then
        update public.profiles set points = points + settings.runner_up_stars where id = winner.user_id;
        insert into public.point_transactions (user_id, amount, kind, note)
        values (winner.user_id, settings.runner_up_stars, 'game', 'Halloween: ' || winner.place || '. miejsce');
      end if;

      insert into public.halloween_winners (place, user_id, score, prize, stars, code, expires_at)
      values (winner.place, winner.user_id, winner.score,
        'Halloween ' || winner.place || '. miejsce: ' || settings.runner_up_stars || ' Stars', settings.runner_up_stars, null, null);
    end if;
    created := created + 1;
  end loop;

  update public.halloween_settings set finalized_at = now() where id = 1;
  return json_build_object('finalized', true, 'created', created);
end;
$$;

-- Publiczne podsumowanie (strona główna, widżety): bez danych osobowych poza imieniem i inicjałem.
create or replace function public.halloween_public()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'active', now() >= s.starts_at and now() < s.ends_at,
    'ended', now() >= s.ends_at,
    'finalized', s.finalized_at is not null,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'runner_up_stars', s.runner_up_stars,
    'prizes', (
      select coalesce(json_agg(json_build_object('place', (p->>'place')::int, 'title', p->>'title', 'short', p->>'short') order by (p->>'place')::int), '[]'::json)
      from jsonb_array_elements(s.prizes) p
    ),
    'winners', coalesce((
      select json_agg(json_build_object(
        'place', w.place,
        'name', private.halloween_display_name(pr.full_name),
        'score', w.score,
        'prize', w.prize
      ) order by w.place)
      from public.halloween_winners w join public.profiles pr on pr.id = w.user_id
      where w.place <= 3
    ), '[]'::json)
  )
  from public.halloween_settings s
  where s.id = 1;
$$;

-- Wyniki zalogowanego klienta: podium, jego nagroda i jego miejsce (także poza top 10).
create or replace function public.halloween_results()
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
    select user_id, score, row_number() over (order by score desc, finished_at asc) as rank from best
  )
  select json_build_object(
    'ended', now() >= s.ends_at,
    'finalized', s.finalized_at is not null,
    'ends_at', s.ends_at,
    'players', (select count(*) from ranked),
    'my_rank', (select json_build_object('rank', r.rank, 'score', r.score) from ranked r where r.user_id = auth.uid()),
    'winners', coalesce((
      select json_agg(json_build_object(
        'place', w.place,
        'name', private.halloween_display_name(p.full_name),
        'score', w.score,
        'prize', w.prize,
        'me', w.user_id = auth.uid()
      ) order by w.place)
      from public.halloween_winners w join public.profiles p on p.id = w.user_id
      where w.place <= 3
    ), '[]'::json),
    'mine', (
      select json_build_object(
        'place', w.place,
        'score', w.score,
        'prize', w.prize,
        'stars', w.stars,
        'code', w.code,
        'expires_at', w.expires_at,
        'redeemed', w.code is not null and w.expires_at > now()
          and not exists (select 1 from public.reward_redemptions r where r.code = w.code),
        'expired', w.expires_at is not null and w.expires_at <= now()
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
revoke all on function public.halloween_public() from public;
grant execute on function public.halloween_public() to anon, authenticated, service_role;
