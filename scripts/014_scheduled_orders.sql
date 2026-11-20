-- Orders placed for a specific time ("na godzinę"). Null means "as soon as possible".
alter table public.orders add column if not exists scheduled_for timestamptz;
create index if not exists orders_scheduled_for_idx on public.orders (scheduled_for) where scheduled_for is not null;
