-- Points from the old app were earned only from orders, so recovered points also raise
-- the Yummy Club tier (profiles.status_points), not just the spendable balance.

alter table public.points_recovery_requests
  add column if not exists counted_in_tier boolean not null default false;

-- Backfill requests that were already resolved before this change (runs once per request).
with pending_backfill as (
  update public.points_recovery_requests
  set counted_in_tier = true
  where status = 'done' and points_awarded is not null and not counted_in_tier
  returning user_id, points_awarded
), per_user as (
  select user_id, sum(points_awarded)::integer as amount from pending_backfill group by user_id
)
update public.profiles p
set status_points = coalesce(p.status_points, 0) + per_user.amount
from per_user
where p.id = per_user.user_id;

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

  update public.profiles
  set points = points + amount,
      status_points = coalesce(status_points, 0) + amount
  where id = target
  returning points into new_points;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  insert into public.point_transactions (user_id, amount, kind, note, created_by)
  values (target, amount, 'staff', 'Punkty ze starej aplikacji', actor);

  update public.points_recovery_requests
  set status = 'done', points_awarded = amount, counted_in_tier = true,
      staff_note = nullif(left(trim(coalesce(note, '')), 200), ''),
      handled_by = actor, handled_at = now()
  where id = request_id;

  return new_points;
end;
$$;

revoke all on function public.resolve_points_recovery(uuid, integer, uuid, text) from public, anon, authenticated;
