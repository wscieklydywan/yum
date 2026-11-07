-- Live order tracking for customers without polling: when the bar/kitchen changes an order's status,
-- the database pushes one tiny Broadcast message to that customer's private topic. The client then
-- refetches its orders once. No Vercel or DB traffic while nothing changes.

create or replace function private.notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is not null and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    begin
      perform realtime.send(
        jsonb_build_object('status', new.status),
        'status',
        'customer-orders:' || new.customer_id::text,
        true
      );
    exception when others then
      -- A Realtime hiccup must never block saving an order.
      null;
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists orders_customer_status_signal on public.orders;
create trigger orders_customer_status_signal
  after insert or update of status on public.orders
  for each row execute function private.notify_customer_order_status();

-- Only the order's owner may listen on their private topic.
drop policy if exists customer_orders_signal_read on realtime.messages;
create policy customer_orders_signal_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'customer-orders:' || (select auth.uid())::text
  );
