-- How the receipt was printed can differ from how the customer finally paid (e.g. delivery: receipt as cash, paid by card).
-- payment_method stays the real payment; receipt_payment_method keeps what is on the printed receipt.
alter table public.orders add column if not exists receipt_payment_method text;
-- Cash handed over by the customer, in grosze, so the order details can show the change that was given back.
alter table public.orders add column if not exists cash_received_grosze integer check (cash_received_grosze is null or cash_received_grosze >= 0);

update public.orders o
set receipt_payment_method = d.payload->>'payment'
from (
  select distinct on (order_id) order_id, payload
  from public.order_documents
  where kind = 'receipt' and status = 'printed'
  order by order_id, created_at
) d
where d.order_id = o.id and o.receipt_payment_method is null;
