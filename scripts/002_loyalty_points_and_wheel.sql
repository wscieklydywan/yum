-- Yummy Club: punkty, historia punktów i koło fortuny.

alter table public.profiles
  add column if not exists points integer not null default 0 check (points >= 0),
  add column if not exists last_free_spin_at timestamptz,
  add column if not exists email_lower text generated always as (lower(email)) stored;

-- Wyszukiwanie po e-mailu (dokładne i prefiksowe) oraz paginacja kursorowa listy klientów.
create index if not exists profiles_email_lower_idx on public.profiles (email_lower text_pattern_ops);
create index if not exists profiles_role_created_idx on public.profiles (role, created_at desc, id desc);

create table if not exists public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind text not null check (kind in ('spin', 'spin_cost', 'staff')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists point_transactions_user_created_idx on public.point_transactions (user_id, created_at desc);
create index if not exists point_transactions_created_by_idx on public.point_transactions (created_by);

alter table public.point_transactions enable row level security;

drop policy if exists point_transactions_select_own on public.point_transactions;
create policy point_transactions_select_own on public.point_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Koło fortuny: losowanie wyłącznie po stronie bazy, 1 darmowe zakręcenie na dzień (czas polski),
-- kolejne za 50 pkt. Segmenty (zgodnie z ruchem wskazówek od góry):
-- 0 burger 150, 1 frytki 30, 2 korona 300, 3 napój 20, 4 prezent 50, 5 kupon 10.
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
  roll double precision := random();
  segment integer;
  prize integer;
  cost integer := 0;
  new_points integer;
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

  segment := case
    when roll < 0.30 then 5
    when roll < 0.55 then 3
    when roll < 0.75 then 1
    when roll < 0.90 then 4
    when roll < 0.97 then 0
    else 2
  end;
  prize := (array[150, 30, 300, 20, 50, 10])[segment + 1];

  update public.profiles
  set points = points - cost + prize,
      last_free_spin_at = case when is_free then now() else last_free_spin_at end
  where id = uid
  returning points into new_points;

  if cost > 0 then
    insert into public.point_transactions (user_id, amount, kind, note)
    values (uid, -cost, 'spin_cost', 'Dodatkowe zakręcenie');
  end if;
  insert into public.point_transactions (user_id, amount, kind, note)
  values (uid, prize, 'spin', 'Koło fortuny');

  return json_build_object('segment', segment, 'prize', prize, 'points', new_points, 'free', is_free);
end;
$$;

revoke all on function public.spin_wheel(boolean) from public, anon;
grant execute on function public.spin_wheel(boolean) to authenticated;

-- Dodawanie punktów przez personel; wywoływane tylko z serwera (service role) po sprawdzeniu roli.
create or replace function public.staff_add_points(target uuid, amount integer, actor uuid, note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_points integer;
begin
  if amount < 1 or amount > 1000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  update public.profiles set points = points + amount
  where id = target and role = 'klient'
  returning points into new_points;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  insert into public.point_transactions (user_id, amount, kind, note, created_by)
  values (target, amount, 'staff', nullif(left(trim(coalesce(note, '')), 120), ''), actor);

  return new_points;
end;
$$;

revoke all on function public.staff_add_points(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.staff_add_points(uuid, integer, uuid, text) to service_role;
