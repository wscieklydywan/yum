-- Halloween: podium (1–3) dostaje wyłącznie jedzenie (kod przy ladzie, bez Stars).
-- Miejsca 4–10 dostają 20 Stars i maila z podziękowaniem (bez kodu).
-- 1. miejsce = „Zestaw dla dwóch” dokładnie jak w menu.

alter table public.halloween_winners drop constraint if exists halloween_winners_place_check;
alter table public.halloween_winners add constraint halloween_winners_place_check check (place between 1 and 10);
alter table public.halloween_winners alter column code drop not null;
alter table public.halloween_winners alter column expires_at drop not null;

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
  runner_up_stars constant integer := 20;
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
    limit 10
  loop
    if winner.place <= 3 then
      select * into prize from (values
        (1, 'Halloween 1. miejsce: Zestaw dla dwóch',
          '[{"name":"Burger Classic","quantity":2},{"name":"Frytki duże","quantity":1},{"name":"KRĄŻKI CEBULOWE","quantity":1},{"name":"Napój 0,5 l","quantity":2}]'::jsonb),
        (2, 'Halloween 2. miejsce: Burger SERTASTIC', '[{"name":"SERTASTIC","quantity":1}]'::jsonb),
        (3, 'Halloween 3. miejsce: Frytki i napój',
          '[{"name":"FRYTKI CIENKIE","quantity":1},{"name":"Napój 0,5 l","quantity":1}]'::jsonb)
      ) as p(place, name, items)
      where p.place = winner.place;

      loop
        new_code := 'DYNIA-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));
        exit when not exists (select 1 from public.reward_redemptions where code = new_code)
          and not exists (select 1 from public.halloween_winners where code = new_code);
      end loop;

      insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
      values (winner.user_id, prize.name, 0, new_code, prize.items, valid_until);

      insert into public.halloween_winners (place, user_id, score, prize, stars, code, expires_at)
      values (winner.place, winner.user_id, winner.score, prize.name, 0, new_code, valid_until);
    else
      update public.profiles set points = points + runner_up_stars where id = winner.user_id;
      insert into public.point_transactions (user_id, amount, kind, note)
      values (winner.user_id, runner_up_stars, 'game', 'Halloween: ' || winner.place || '. miejsce');

      insert into public.halloween_winners (place, user_id, score, prize, stars, code, expires_at)
      values (winner.place, winner.user_id, winner.score, 'Halloween ' || winner.place || '. miejsce: 20 Stars', runner_up_stars, null, null);
    end if;
    created := created + 1;
  end loop;

  update public.halloween_settings set finalized_at = now() where id = 1;
  return json_build_object('finalized', true, 'created', created);
end;
$$;

-- Podium publicznie tylko 1–3; własny wynik klienta (1–10) w polu „mine”.
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
        -- Kupon znika z reward_redemptions po wydaniu przy ladzie.
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
