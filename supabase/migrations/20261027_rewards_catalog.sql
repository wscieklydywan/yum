-- Reward catalog priced against the real menu and the 1 Star / 10 zł earn rate.
-- Must match `rewards` in lib/loyalty.ts.
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
    ('sauce', 'Sos do wyboru', 15, '[{"name":"Sos do wyboru","quantity":1}]'::jsonb),
    ('double', 'Upgrade burgera na DOUBLE', 40, '[{"name":"Upgrade na DOUBLE","quantity":1}]'::jsonb),
    ('drink', 'Napój 0,5 l', 50, '[{"name":"Napój 0,5 l","quantity":1}]'::jsonb),
    ('fries', 'Frytki cienkie', 70, '[{"name":"FRYTKI CIENKIE","quantity":1}]'::jsonb),
    ('rings', 'Krążki cebulowe', 90, '[{"name":"KRĄŻKI CEBULOWE","quantity":1}]'::jsonb),
    ('nuggets', 'Nuggetsy', 100, '[{"name":"NUGGETSY","quantity":1}]'::jsonb),
    ('burger', 'Burger SERTASTIC', 300, '[{"name":"SERTASTIC","quantity":1}]'::jsonb),
    ('combo', 'Zestaw SERTASTIC', 450, '[{"name":"SERTASTIC","quantity":1},{"name":"FRYTKI CIENKIE","quantity":1},{"name":"Napój 0,5 l","quantity":1}]'::jsonb)
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
