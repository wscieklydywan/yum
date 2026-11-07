alter table public.orders add column if not exists cancelled_from text;
alter table public.orders add column if not exists cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.workshop_order_action(p_order_id uuid, p_action text, p_index integer DEFAULT NULL::integer, p_value text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    when 'hand_off' then
      if actor_role not in ('admin', 'szef', 'kelner', 'kierowca') or current_order.status <> 'ready' then
        raise exception 'Zamówienie nie jest gotowe do wydania.' using errcode = '42501';
      end if;
      update public.orders set status = 'handed_off', handed_off_at = now() where id = p_order_id;

    when 'undo_hand_off' then
      if actor_role not in ('admin', 'szef', 'kelner') or current_order.status <> 'handed_off' then
        raise exception 'Tego wydania nie można cofnąć.' using errcode = '42501';
      end if;
      update public.orders set status = 'ready', handed_off_at = null where id = p_order_id;

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
$function$;
