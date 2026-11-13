-- Requests from Yummy Club members to move their points over from the old app.
create table if not exists public.points_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  phone text,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  points_awarded integer check (points_awarded is null or points_awarded > 0),
  staff_note text,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists points_recovery_requests_status_idx on public.points_recovery_requests (status, created_at desc);
create index if not exists points_recovery_requests_user_idx on public.points_recovery_requests (user_id, created_at desc);
-- Points can be recovered once per account; a rejected request may be sent again.
create unique index if not exists points_recovery_requests_one_open on public.points_recovery_requests (user_id) where status in ('pending', 'done');

alter table public.points_recovery_requests enable row level security;

create or replace function public.resolve_points_recovery(request_id uuid, amount integer, actor uuid, note text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  target uuid;
  new_points integer;
begin
  if amount is null or amount < 1 or amount > 100000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select user_id into target from public.points_recovery_requests
  where id = request_id and status = 'pending'
  for update;
  if not found then
    raise exception 'request_not_pending' using errcode = 'P0002';
  end if;

  update public.profiles set points = points + amount
  where id = target
  returning points into new_points;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  insert into public.point_transactions (user_id, amount, kind, note, created_by)
  values (target, amount, 'staff', 'Punkty ze starej aplikacji', actor);

  update public.points_recovery_requests
  set status = 'done', points_awarded = amount, staff_note = nullif(left(trim(coalesce(note, '')), 200), ''),
      handled_by = actor, handled_at = now()
  where id = request_id;

  return new_points;
end;
$$;

revoke all on function public.resolve_points_recovery(uuid, integer, uuid, text) from public, anon, authenticated;
