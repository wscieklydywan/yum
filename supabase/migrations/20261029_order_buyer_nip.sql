-- Buyer NIP entered at the bar while taking payment; printed on the order's receipt.
alter table public.orders add column if not exists buyer_nip text;
notify pgrst, 'reload schema';
