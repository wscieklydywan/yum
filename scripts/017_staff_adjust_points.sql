-- Obsługa (bar/admin/szef) może dodawać i odejmować punkty klientom. Saldo nie może spaść poniżej zera.
create or replace function public.staff_adjust_points(target uuid, amount integer, actor uuid, note text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_points integer;
  new_points integer;
begin
  if amount = 0 or amount < -1000 or amount > 1000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select points into current_points from public.profiles
  where id = target and role = 'klient'
  for update;
  if not found then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;
  if current_points + amount < 0 then
    raise exception 'insufficient_points' using errcode = '22023';
  end if;

  update public.profiles set points = points + amount
  where id = target
  returning points into new_points;

  insert into public.point_transactions (user_id, amount, kind, note, created_by)
  values (target, amount, 'staff', nullif(left(trim(coalesce(note, '')), 120), ''), actor);

  return new_points;
end;
$$;

revoke all on function public.staff_adjust_points(uuid, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.staff_adjust_points(uuid, integer, uuid, text) to service_role;
