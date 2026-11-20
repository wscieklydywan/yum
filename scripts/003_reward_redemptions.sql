-- Yummy Club: wymiana punktów na nagrody (kod do okazania przy zamówieniu).

alter table public.point_transactions drop constraint if exists point_transactions_kind_check;
alter table public.point_transactions
  add constraint point_transactions_kind_check check (kind in ('spin', 'spin_cost', 'staff', 'redeem'));

create table if not exists public.reward_redemptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reward text not null,
  cost integer not null check (cost > 0),
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'used')),
  created_at timestamptz not null default now()
);

create index if not exists reward_redemptions_user_created_idx on public.reward_redemptions (user_id, created_at desc);

alter table public.reward_redemptions enable row level security;

drop policy if exists reward_redemptions_select_own on public.reward_redemptions;
create policy reward_redemptions_select_own on public.reward_redemptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Koszt nagrody ustalany wyłącznie po stronie bazy.
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
  current_points integer;
  new_points integer;
  new_code text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select r.name, r.cost into reward_name, reward_cost
  from (values ('burger', 'Burger klasyczny', 150), ('fries', 'Frytki', 100), ('drink', 'Napój 0,5 l', 100))
    as r(key, name, cost)
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

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.reward_redemptions where code = new_code);
  end loop;

  update public.profiles set points = points - reward_cost where id = uid returning points into new_points;

  insert into public.reward_redemptions (user_id, reward, cost, code)
  values (uid, reward_name, reward_cost, new_code);
  insert into public.point_transactions (user_id, amount, kind, note)
  values (uid, -reward_cost, 'redeem', reward_name);

  return json_build_object('code', new_code, 'points', new_points, 'reward', reward_name, 'cost', reward_cost);
end;
$$;

revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;
