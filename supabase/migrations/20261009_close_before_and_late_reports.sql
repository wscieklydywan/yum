-- Stop online orders N minutes before the configured closing time.
alter table public.restaurant_settings
  add column if not exists close_before_minutes smallint not null default 0
  check (close_before_minutes between 0 and 180);

-- A closed day's report stays "open" for late orders (in-progress at close,
-- manual orders added after closing) until the next day is opened.
alter table public.day_reports add column if not exists finalized_at timestamptz;
