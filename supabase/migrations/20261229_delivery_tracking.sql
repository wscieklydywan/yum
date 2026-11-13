-- Dowóz: kierowca bierze gotowe zamówienie ("Jadę") -> klient widzi "W trasie" -> "Dostarczone" (= handed_off).
-- Status zostaje 'ready' (raporty, paragony i reguły wydania bez zmian); trasa to osobne pola.
-- Zamówienie w trasie znika z kolejek baru do paska "W trasie", skąd bar może je cofnąć.

alter table public.orders
  add column if not exists out_for_delivery_at timestamptz,
  add column if not exists driver_id uuid references auth.users (id) on delete set null,
  add column if not exists delivery_note text;

-- Trasa ma sens tylko dla gotowego lub wydanego zamówienia.
create or replace function private.orders_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_count int;
  done_count int;
begin
  if tg_op = 'INSERT' then
    new.items := private.normalize_order_items(new.items);
  end if;

  if new.status in ('preparing', 'ready') then
    select
      count(*) filter (where not coalesce((item->>'cancelled')::boolean, false)),
      count(*) filter (where not coalesce((item->>'cancelled')::boolean, false) and coalesce((item->>'done')::boolean, false))
    into active_count, done_count
    from jsonb_array_elements(new.items) as item;

    if active_count > 0 and active_count = done_count then
      new.status := 'ready';
      new.ready_at := coalesce(new.ready_at, now());
    else
      new.status := 'preparing';
      new.ready_at := null;
    end if;
  end if;

  if new.status not in ('ready', 'handed_off') then
    new.out_for_delivery_at := null;
    new.driver_id := null;
  end if;

  new.handed_off := new.status = 'handed_off';
  return new;
end;
$$;

-- Trigger musi reagować też na zmianę pól trasy.
drop trigger if exists orders_workflow on public.orders;
create trigger orders_workflow
  before insert or update of items, status, out_for_delivery_at on public.orders
  for each row execute function private.orders_workflow();

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
    'paid_at', 'receipt_payment_method', 'cash_received_grosze', 'payment_split', 'buyer_nip', 'pending_receipt_id',
    'pending_receipt_at', 'distance_km', 'preferred_payment', 'customer_id', 'out_for_delivery_at', 'driver_id', 'delivery_note'
  ])
$$;

-- Klient dostaje sygnał także wtedy, gdy kierowca wyjeżdża lub wraca.
create or replace function private.notify_customer_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id is not null and (
    tg_op = 'INSERT'
    or new.status is distinct from old.status
    or new.out_for_delivery_at is distinct from old.out_for_delivery_at
  ) then
    begin
      perform realtime.send(
        jsonb_build_object('status', new.status, 'in_delivery', new.out_for_delivery_at is not null),
        'status',
        'customer-orders:' || new.customer_id::text,
        true
      );
    exception when others then
      null;
    end;
  end if;
  return null;
end;
$$;

create or replace function public.workshop_order_action(
  p_order_id uuid,
  p_action text,
  p_index int default null,
  p_value text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := coalesce((select private.user_role()), '');
  current_order public.orders%rowtype;
  item jsonb;
  item_station text;
begin
  if actor_role not in ('admin', 'szef', 'kelner', 'kuchnia', 'kierowca') then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Zamówienie nie istnieje.' using errcode = 'P0002';
  end if;

  if actor_role = 'kierowca' and current_order.type <> 'Dostawa' then
    raise exception 'Kierowca obsługuje tylko dowozy.' using errcode = '42501';
  end if;

  perform set_config('app.workshop_action', 'on', true);

  if p_index is not null then
    item := current_order.items -> p_index;
    if item is null then
      raise exception 'Pozycja nie istnieje.' using errcode = '22023';
    end if;
    item_station := coalesce(item->>'station', 'kitchen');
  end if;

  case p_action
    when 'accept' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status <> 'new' then
        raise exception 'Nie można zaakceptować tego zamówienia.' using errcode = '42501';
      end if;
      update public.orders set status = 'preparing', started_at = now() where id = p_order_id;

    when 'toggle_item' then
      if current_order.status not in ('preparing', 'ready')
        or (item_station = 'kitchen' and actor_role not in ('admin', 'szef', 'kuchnia'))
        or (item_station = 'cashier' and actor_role not in ('admin', 'szef', 'kelner')) then
        raise exception 'Nie można zmienić tej pozycji.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem' || jsonb_build_object('done', p_value = 'true'))
      where id = p_order_id;

    when 'report_problem' then
      if current_order.status not in ('preparing', 'ready')
        or (item_station = 'kitchen' and actor_role not in ('admin', 'szef', 'kuchnia'))
        or (item_station = 'cashier' and actor_role not in ('admin', 'szef', 'kelner')) then
        raise exception 'Nie można zgłosić problemu.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) || jsonb_build_object('problem', left(coalesce(nullif(trim(p_value), ''), 'Problem'), 120), 'done', false))
      where id = p_order_id;

    when 'resolve_problem' then
      if actor_role not in ('admin', 'szef', 'kelner') then
        raise exception 'Problem rozwiązuje bar.' using errcode = '42501';
      end if;
      update public.orders set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem') where id = p_order_id;

    when 'cancel_item' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status not in ('new', 'preparing', 'ready') then
        raise exception 'Pozycję anuluje bar.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem' || jsonb_build_object('cancelled', p_value <> 'false'))
      where id = p_order_id;

    when 'start_delivery' then
      if actor_role not in ('admin', 'szef', 'kelner', 'kierowca') or current_order.type <> 'Dostawa' or current_order.status <> 'ready' then
        raise exception 'Zamówienie nie jest gotowe do wyjazdu.' using errcode = '42501';
      end if;
      if current_order.out_for_delivery_at is not null then
        raise exception 'To zamówienie jest już w trasie.' using errcode = '42501';
      end if;
      update public.orders
      set out_for_delivery_at = now(), driver_id = auth.uid(), delivery_note = null
      where id = p_order_id;

    when 'return_delivery' then
      if actor_role not in ('admin', 'szef', 'kelner', 'kierowca') or current_order.status <> 'ready' or current_order.out_for_delivery_at is null then
        raise exception 'To zamówienie nie jest w trasie.' using errcode = '42501';
      end if;
      update public.orders
      set out_for_delivery_at = null, driver_id = null, delivery_note = left(nullif(trim(p_value), ''), 200)
      where id = p_order_id;

    when 'hand_off' then
      if actor_role not in ('admin', 'szef', 'kelner', 'kierowca') or current_order.status <> 'ready' then
        raise exception 'Zamówienie nie jest gotowe do wydania.' using errcode = '42501';
      end if;
      if actor_role = 'kierowca' and current_order.out_for_delivery_at is null then
        raise exception 'Najpierw oznacz, że jedziesz z tym zamówieniem.' using errcode = '42501';
      end if;
      update public.orders set status = 'handed_off', handed_off_at = now() where id = p_order_id;

    when 'undo_hand_off' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status <> 'handed_off' then
        raise exception 'Tego wydania nie można cofnąć.' using errcode = '42501';
      end if;
      update public.orders set status = 'ready', handed_off_at = null, out_for_delivery_at = null, driver_id = null where id = p_order_id;

    when 'cancel_order' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status not in ('new', 'preparing', 'ready') then
        raise exception 'Zamówienie anuluje bar.' using errcode = '42501';
      end if;
      if exists (
        select 1 from jsonb_array_elements(current_order.items) as entry
        where coalesce((entry->>'receipted')::int, 0) > coalesce((entry->>'refunded')::int, 0)
      ) then
        raise exception 'Paragon jest już wydrukowany – najpierw zrób zwrot.' using errcode = '42501';
      end if;
      update public.orders
      set status = 'cancelled', cancelled_from = current_order.status, cancelled_at = now(), cancel_reason = left(nullif(trim(p_value), ''), 200)
      where id = p_order_id;

    when 'restore_order' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status <> 'cancelled' then
        raise exception 'Tego zamówienia nie można przywrócić.' using errcode = '42501';
      end if;
      update public.orders
      set status = case when coalesce(current_order.cancelled_from, 'new') = 'new' then 'new' else 'preparing' end,
          cancelled_from = null, cancelled_at = null, cancel_reason = null
      where id = p_order_id;

    else
      raise exception 'Nieznana akcja.' using errcode = '22023';
  end case;
end;
$$;

revoke all on function public.workshop_order_action(uuid, text, int, text) from public, anon;
grant execute on function public.workshop_order_action(uuid, text, int, text) to authenticated;
