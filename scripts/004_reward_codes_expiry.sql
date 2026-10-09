-- Yummy Club: kupony ważne 24h, lista pozycji w kuponie, jednorazowa realizacja w warsztacie.
-- Wykorzystany lub przeterminowany kupon jest usuwany.

alter table public.reward_redemptions
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours'),
  add column if not exists items jsonb not null default '[]'::jsonb;

update public.reward_redemptions
set items = jsonb_build_array(jsonb_build_object('name', reward, 'quantity', 1))
where items = '[]'::jsonb;

delete from public.reward_redemptions where status = 'used' or expires_at <= now();

create index if not exists reward_redemptions_expires_idx on public.reward_redemptions (expires_at);

drop policy if exists reward_redemptions_select_own on public.reward_redemptions;
create policy reward_redemptions_select_own on public.reward_redemptions
  for select to authenticated
  using ((select auth.uid()) = user_id and expires_at > now());

create or replace function public.redeem_reward(reward_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  reward_name text;
  reward_cost integer;
  reward_items jsonb;
  current_points integer;
  new_points integer;
  new_code text;
  new_id bigint;
  new_expires timestamptz := now() + interval '24 hours';
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select r.name, r.cost, r.items into reward_name, reward_cost, reward_items
  from (values
    ('burger', 'Burger klasyczny', 150, '[{"name":"Burger klasyczny","quantity":1}]'::jsonb),
    ('fries', 'Frytki', 100, '[{"name":"Frytki","quantity":1}]'::jsonb),
    ('drink', 'Napój 0,5 l', 100, '[{"name":"Napój 0,5 l","quantity":1}]'::jsonb),
    ('combo', 'Zestaw Yummy', 300, '[{"name":"Burger klasyczny","quantity":1},{"name":"Frytki","quantity":1},{"name":"Napój 0,5 l","quantity":1}]'::jsonb)
  ) as r(key, name, cost, items)
  where r.key = reward_key;
  if reward_name is null then
    raise exception 'unknown_reward' using errcode = '22023';
  end if;

  select points into current_points from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if current_points < reward_cost then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;

  delete from public.reward_redemptions where expires_at <= now();

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.reward_redemptions where code = new_code);
  end loop;

  update public.profiles set points = points - reward_cost where id = uid returning points into new_points;

  insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
  values (uid, reward_name, reward_cost, new_code, reward_items, new_expires)
  returning id into new_id;
  insert into public.point_transactions (user_id, amount, kind, note)
  values (uid, -reward_cost, 'redeem', reward_name);

  return json_build_object(
    'id', new_id,
    'code', new_code, 'points', new_points, 'reward', reward_name, 'cost', reward_cost,
    'items', reward_items, 'expires_at', new_expires
  );
end;
$$;

revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;

-- Hourly cleanup of expired coupons (pg_cron), in addition to the lazy cleanup above.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'yummy_expire_reward_codes';
select cron.schedule('yummy_expire_reward_codes', '0 * * * *', $$delete from public.reward_redemptions where expires_at <= now()$$);
