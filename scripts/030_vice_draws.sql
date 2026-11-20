create table if not exists public.vice_draws (
  id uuid primary key default gen_random_uuid(),
  winner_key text not null,
  winner_name text,
  winner_phone text,
  winner_email text,
  winner_tickets integer not null,
  ticket_number integer not null,
  total_tickets integer not null,
  participants integer not null,
  drawn_by uuid references auth.users(id) on delete set null,
  drawn_at timestamptz not null default now()
);
create index if not exists vice_draws_drawn_at_idx on public.vice_draws (drawn_at desc);
alter table public.vice_draws enable row level security;
