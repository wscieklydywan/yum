-- Payment method is stored on the order itself, so cash reports do not depend on printed receipts.
alter table public.orders add column if not exists payment_method text
  check (payment_method in ('cash', 'card', 'transfer', 'online'));

-- Backfill from already issued receipts.
update public.orders o
set payment_method = d.payload->>'payment'
from (
  select distinct on (order_id) order_id, payload
  from public.order_documents
  where kind = 'receipt' and status <> 'voided' and payload ? 'payment'
  order by order_id, created_at desc
) d
where d.order_id = o.id and o.payment_method is null and d.payload->>'payment' in ('cash', 'card', 'transfer');

create table if not exists public.cash_reports (
  id uuid primary key default gen_random_uuid(),
  period_from timestamptz not null,
  period_to timestamptz not null,
  summary jsonb not null,
  opening_cash numeric(10,2) not null default 0,
  counted_cash numeric(10,2) not null,
  difference numeric(10,2) not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.cash_reports enable row level security;
-- No policies: accessed only through the server with the service role.
