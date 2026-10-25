-- What the customer declared at checkout. payment_method stays the real, settled payment.
alter table public.orders add column if not exists preferred_payment text
  check (preferred_payment in ('cash', 'card'));
