-- Web Push for customers who installed the public PWA (main site or Yummy Club).
-- Anonymous devices are allowed; user_id is filled when the customer is signed in to Yummy Club.
-- Server-only table (service role); RLS is on with no policies.

create table if not exists public.public_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users (id) on delete set null,
  app text not null default 'site' check (app in ('site', 'club')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_push_subscriptions_user_idx on public.public_push_subscriptions (user_id);

alter table public.public_push_subscriptions enable row level security;
revoke all on public.public_push_subscriptions from anon, authenticated;
