-- Web Push: per-device subscriptions of the workshop panel and the server's VAPID key pair.
-- Both tables are server-only (service role); RLS is on with no policies.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  station text not null check (station in ('kitchen', 'cashier')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_station_idx on public.push_subscriptions (station);

create table if not exists public.push_vapid_keys (
  id smallint primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_vapid_keys enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_vapid_keys from anon, authenticated;
