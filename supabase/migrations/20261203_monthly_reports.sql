-- Snapshots of monthly reports: a finished month is computed once and read from here afterwards.
-- The current month is stored too, but only reused for a few minutes.
create table if not exists public.monthly_reports (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  summary jsonb not null,
  business_days integer not null default 0,
  computed_at timestamptz not null default now()
);

alter table public.monthly_reports enable row level security;
