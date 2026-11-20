create table if not exists public.app_installs (
  device_id uuid primary key,
  app text not null check (app in ('site', 'club')),
  platform text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  source text not null check (source in ('appinstalled', 'standalone')),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_installs_created_at_idx on public.app_installs (created_at);
create index if not exists app_installs_last_seen_idx on public.app_installs (last_seen_at);
create index if not exists app_installs_user_idx on public.app_installs (user_id);

alter table public.app_installs enable row level security;
