-- Restaurant operating state (singleton) and end-of-day reports.
create table if not exists public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),
  kitchen_open boolean not null default true,
  bar_open boolean not null default true,
  day_open boolean not null default false,
  day_opened_at timestamptz,
  day_opened_by uuid references auth.users (id) on delete set null,
  auto_hours boolean not null default true,
  opening_hours jsonb not null default '[
    {"open":"11:00","close":"22:00","closed":false},
    {"open":"11:00","close":"22:00","closed":false},
    {"open":"11:00","close":"22:00","closed":false},
    {"open":"11:00","close":"22:00","closed":false},
    {"open":"11:00","close":"23:00","closed":false},
    {"open":"12:00","close":"23:00","closed":false},
    {"open":"12:00","close":"21:00","closed":false}
  ]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.restaurant_settings (id) values (1) on conflict (id) do nothing;

alter table public.restaurant_settings enable row level security;
drop policy if exists restaurant_settings_public_read on public.restaurant_settings;
create policy restaurant_settings_public_read on public.restaurant_settings for select to anon, authenticated using (true);

create table if not exists public.day_reports (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null,
  closed_at timestamptz not null default now(),
  opened_by uuid references auth.users (id) on delete set null,
  closed_by uuid references auth.users (id) on delete set null,
  summary jsonb not null
);

create index if not exists day_reports_closed_at_idx on public.day_reports (closed_at desc);

alter table public.day_reports enable row level security;
drop policy if exists day_reports_manager_read on public.day_reports;
create policy day_reports_manager_read on public.day_reports for select to authenticated
  using ((select private.user_role()) = any (array['admin', 'szef']));
