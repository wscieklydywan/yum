-- Split bill: the customer pays one order with several methods, e.g. part by card and the rest by BLIK / transfer.
-- Array of { "method": "cash" | "card" | "transfer", "amount": grosze }. payment_method keeps the largest part,
-- so everything that only knows a single method keeps working; the cash report splits the amounts by method.
alter table public.orders add column if not exists payment_split jsonb
  check (payment_split is null or jsonb_typeof(payment_split) = 'array');
