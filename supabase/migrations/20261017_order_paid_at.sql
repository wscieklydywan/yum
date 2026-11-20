-- Payment is tracked separately from the receipt: a delivery receipt is often printed before the driver collects the money.
alter table public.orders add column if not exists paid_at timestamptz;

update public.orders
set paid_at = coalesce(handed_off_at, created_at)
where paid_at is null and payment_method is not null;
