-- Manual "force online ordering" outside opening hours. Ignored once the timestamp passes,
-- so it switches itself off at the next regular opening time.
alter table public.restaurant_settings
  add column if not exists ordering_override_until timestamptz;
