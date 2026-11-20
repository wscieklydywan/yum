-- The working day opens by itself: a business day is the Warsaw calendar day starting at 04:00
-- (orders after midnight still belong to the previous evening). Staff only close the day.
-- Orders finished after closing stay editable and are added to the same day's report.
alter table public.restaurant_settings add column if not exists day_closed_at timestamptz;

create or replace function public.business_day_start(at_time timestamptz)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select (date_trunc('day', (at_time at time zone 'Europe/Warsaw') - interval '4 hours') + interval '4 hours') at time zone 'Europe/Warsaw';
$$;

create or replace function public.order_finished_in_closed_day(finished_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select finished_at is null
       or finished_at < greatest(coalesce(s.day_opened_at, '-infinity'::timestamptz), public.business_day_start(now()))
       or (not s.day_open and s.day_closed_at is not null and s.day_opened_at >= public.business_day_start(now()) and finished_at <= s.day_closed_at)
     from public.restaurant_settings s where s.id = 1),
    true
  );
$$;
