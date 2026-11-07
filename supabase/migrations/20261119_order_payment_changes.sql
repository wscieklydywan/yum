-- Audit of payment-method changes on orders whose receipt is already printed (who changed it and why).
create table if not exists public.order_payment_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  receipt_method text,
  from_method text,
  to_method text not null,
  changed_by_name text not null check (char_length(changed_by_name) between 2 and 80),
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_payment_changes_order_idx on public.order_payment_changes (order_id, created_at desc);
create index if not exists order_payment_changes_created_by_idx on public.order_payment_changes (created_by);

alter table public.order_payment_changes enable row level security;
-- No policies: accessed only through the server with the service role.
