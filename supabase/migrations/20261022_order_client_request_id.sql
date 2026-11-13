-- Idempotency key for orders entered at the bar: a retried „Dodaj” / „Dodaj i rozlicz” returns the same order instead of creating a duplicate.
alter table public.orders add column if not exists client_request_id uuid;
create unique index if not exists orders_client_request_id_key on public.orders (client_request_id);
notify pgrst, 'reload schema';
