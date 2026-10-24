-- Back to an explicit working day: staff open and close it. A day nobody closed is closed
-- automatically at midnight (Warsaw) and flagged, so the bar is reminded about the reports.
-- Orders cannot go into preparation while the day is closed – they wait in "Nowe".
alter table public.restaurant_settings add column if not exists day_auto_closed boolean not null default false;

create or replace function public.business_day_is_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.day_open
        and s.day_opened_at is not null
        and s.day_opened_at >= (date_trunc('day', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw')
     from public.restaurant_settings s where s.id = 1),
    false
  );
$$;

revoke execute on function public.business_day_is_open() from public, anon, authenticated;

create or replace function public.order_finished_in_closed_day(finished_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select not public.business_day_is_open() or finished_at is null or finished_at < s.day_opened_at
     from public.restaurant_settings s where s.id = 1),
    true
  );
$$;

revoke execute on function public.order_finished_in_closed_day(timestamptz) from public, anon, authenticated;

create or replace function public.enforce_open_day_for_preparing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'preparing'
     and (tg_op = 'INSERT' or old.status = 'new')
     and not public.business_day_is_open() then
    raise exception 'Najpierw otwórz dzień.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_open_day on public.orders;
create trigger orders_require_open_day
before insert or update of status on public.orders
for each row execute function public.enforce_open_day_for_preparing();

-- Duplicate empty report of 23.10 (its orders are in the automatic report for that day).
delete from public.day_reports where id = '0fb9e942-8213-429b-9e23-6940c2fa49ab';
