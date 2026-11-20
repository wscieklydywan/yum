-- No app path deletes orders; cancellations go through the workshop API.
-- The old policy let any kitchen/admin JWT hard-delete orders (and cascade receipts) via the REST API.
drop policy if exists orders_kitchen_delete on public.orders;
revoke delete on public.orders from anon, authenticated;
