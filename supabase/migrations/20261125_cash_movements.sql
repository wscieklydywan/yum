-- Cash taken from or put into the drawer outside of sales (e.g. 200 zł for fuel). Every movement is signed by name.
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('withdrawal', 'deposit')),
  amount numeric(10,2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 1 and 200),
  signed_by text not null check (char_length(signed_by) between 2 and 60),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_created_at_idx on public.cash_movements (created_at desc);

alter table public.cash_movements enable row level security;
-- No policies: accessed only through the server with the service role.
