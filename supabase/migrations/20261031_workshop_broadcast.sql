-- Workshop Realtime via private Broadcast topics (replaces postgres_changes on orders, menu and restaurant_settings).
-- Topics: workshop:orders (admin/szef/kuchnia/kelner), workshop:delivery (kierowca, delivery orders only),
-- workshop:menu and workshop:settings (all staff, "refresh" signal only). Apps can only receive; only these triggers send.

create or replace function private.workshop_order_row(o public.orders)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  from jsonb_each(to_jsonb(o)) e
  where e.key = any (array[
    'id', 'number', 'status', 'type', 'customer', 'phone', 'address', 'postcode', 'items', 'note', 'eta',
    'scheduled_for', 'paused', 'handed_off', 'created_at', 'ready_at', 'handed_off_at', 'cancelled_at',
    'cancelled_from', 'cancel_reason', 'source', 'discount', 'delivery_fee', 'total', 'payment_method',
    'paid_at', 'receipt_payment_method', 'cash_received_grosze', 'payment_split', 'buyer_nip'
  ])
$$;

create or replace function private.broadcast_workshop_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed jsonb;
  changed jsonb;
begin
  begin
    if tg_op = 'DELETE' then
      removed := jsonb_build_object('event', 'DELETE', 'id', old.id);
      perform realtime.send(removed, 'order', 'workshop:orders', true);
      if old.type = 'Dostawa' then
        perform realtime.send(removed, 'order', 'workshop:delivery', true);
      end if;
      return null;
    end if;

    changed := jsonb_build_object('event', tg_op, 'record', private.workshop_order_row(new));
    perform realtime.send(changed, 'order', 'workshop:orders', true);

    if new.type = 'Dostawa' then
      perform realtime.send(changed, 'order', 'workshop:delivery', true);
    elsif tg_op = 'UPDATE' and old.type = 'Dostawa' then
      -- No longer a delivery: the driver may not see it anymore.
      perform realtime.send(jsonb_build_object('event', 'DELETE', 'id', new.id), 'order', 'workshop:delivery', true);
    end if;
  exception when others then
    -- A Realtime hiccup must never block saving an order.
    null;
  end;
  return null;
end;
$$;

create or replace function private.broadcast_workshop_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name), 'refresh', tg_argv[0], true);
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function private.broadcast_workshop_order() from public, anon, authenticated;
revoke all on function private.broadcast_workshop_refresh() from public, anon, authenticated;

drop trigger if exists orders_workshop_broadcast on public.orders;
create trigger orders_workshop_broadcast
  after insert or update or delete on public.orders
  for each row execute function private.broadcast_workshop_order();

drop trigger if exists menu_products_workshop_broadcast on public.menu_products;
create trigger menu_products_workshop_broadcast
  after insert or update or delete on public.menu_products
  for each statement execute function private.broadcast_workshop_refresh('workshop:menu');

drop trigger if exists menu_categories_workshop_broadcast on public.menu_categories;
create trigger menu_categories_workshop_broadcast
  after insert or update or delete on public.menu_categories
  for each statement execute function private.broadcast_workshop_refresh('workshop:menu');

drop trigger if exists menu_product_variants_workshop_broadcast on public.menu_product_variants;
create trigger menu_product_variants_workshop_broadcast
  after insert or update or delete on public.menu_product_variants
  for each statement execute function private.broadcast_workshop_refresh('workshop:menu');

drop trigger if exists menu_modifier_options_workshop_broadcast on public.menu_modifier_options;
create trigger menu_modifier_options_workshop_broadcast
  after insert or update or delete on public.menu_modifier_options
  for each statement execute function private.broadcast_workshop_refresh('workshop:menu');

drop trigger if exists menu_modifier_groups_workshop_broadcast on public.menu_modifier_groups;
create trigger menu_modifier_groups_workshop_broadcast
  after insert or update or delete on public.menu_modifier_groups
  for each statement execute function private.broadcast_workshop_refresh('workshop:menu');

drop trigger if exists restaurant_settings_workshop_broadcast on public.restaurant_settings;
create trigger restaurant_settings_workshop_broadcast
  after insert or update or delete on public.restaurant_settings
  for each statement execute function private.broadcast_workshop_refresh('workshop:settings');

drop policy if exists workshop_broadcast_read on realtime.messages;
create policy workshop_broadcast_read on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and (
      ((select realtime.topic()) = 'workshop:orders'
        and (select private.user_role()) = any (array['admin', 'szef', 'kuchnia', 'kelner']))
      or ((select realtime.topic()) = 'workshop:delivery'
        and (select private.user_role()) = 'kierowca')
      or ((select realtime.topic()) = any (array['workshop:menu', 'workshop:settings'])
        and (select private.user_role()) = any (array['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']))
    )
  );
