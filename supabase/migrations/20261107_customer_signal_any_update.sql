-- "UPDATE OF status" only fires when the statement itself sets status. The kitchen marks items done
-- (UPDATE of items) and private.orders_workflow flips status to 'ready' in a BEFORE trigger, so the
-- customer never got the preparing -> ready signal. Fire on any update; the function still sends
-- only when status actually changed.
drop trigger if exists orders_customer_status_signal on public.orders;
create trigger orders_customer_status_signal
  after insert or update on public.orders
  for each row execute function private.notify_customer_order_status();
