-- Per-product VAT rate. Letters are the menu's own labels: A 23%, B 8%, C 5%, D 0%.
-- The POSNET bridge matches receipts by percent, so these letters do not have to equal printer PTU slots.
--
-- Existing products are intentionally left NULL: no rate is assumed. They are listed in
-- public.menu_products_missing_vat and must be set in Warsztat → Menu.
-- Receipts for order items without a rate are blocked with a clear message instead of silently using 8%.

alter table public.menu_products add column if not exists vat text;
alter table public.menu_products drop constraint if exists menu_products_vat_check;
alter table public.menu_products add constraint menu_products_vat_check check (vat is null or vat in ('A', 'B', 'C', 'D'));
comment on column public.menu_products.vat is 'VAT letter: A=23%, B=8%, C=5%, D=0%. NULL = not verified yet.';

create or replace view public.menu_products_missing_vat with (security_invoker = true) as
  select id, name, category_id, available
  from public.menu_products
  where vat is null
  order by category_id, sort;

revoke all on public.menu_products_missing_vat from anon;

-- New orders: carry the product's rate onto items that arrive without one (safety net for any insert path).
create or replace function private.normalize_order_items(p_items jsonb)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(jsonb_agg(
    item
      || jsonb_build_object(
        'id', coalesce(item->>'id', gen_random_uuid()::text),
        'station', coalesce(item->>'station', (select m.station from public.menu_products m where m.name = item->>'name' limit 1), 'kitchen'),
        'done', coalesce((item->>'done')::boolean, false)
      )
      || coalesce(case when item->>'vat' in ('A', 'B', 'C', 'D') then null
        else (select jsonb_build_object('vat', m.vat) from public.menu_products m where m.name = item->>'name' and m.vat is not null limit 1) end, '{}'::jsonb)
    order by ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entries(item, ordinality);
$function$;

-- A unit already on a receipt keeps the VAT rate it was fiscalized with.
create or replace function private.protect_receipted_items()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  old_item jsonb;
  new_item jsonb;
  receipted int;
begin
  if current_setting('app.receipt_action', true) = 'on' then
    return new;
  end if;

  for old_item in select value from jsonb_array_elements(old.items) loop
    receipted := coalesce((old_item->>'receipted')::int, 0);
    select value into new_item from jsonb_array_elements(new.items) where value->>'id' = old_item->>'id' limit 1;

    if coalesce((new_item->>'receipted')::int, 0) <> receipted
      or coalesce((new_item->>'refunded')::int, 0) <> coalesce((old_item->>'refunded')::int, 0) then
      raise exception 'Liczniki paragonu zmienia tylko kasa fiskalna.' using errcode = '42501';
    end if;

    continue when receipted = 0;

    if new_item is null
      or coalesce((new_item->>'cancelled')::boolean, false) and not coalesce((old_item->>'cancelled')::boolean, false)
      or (new_item->>'quantity')::int < receipted
      or (new_item->'unitPrice') is distinct from (old_item->'unitPrice')
      or (new_item->'name') is distinct from (old_item->'name')
      or (new_item->'options') is distinct from (old_item->'options')
      or (new_item->'vat') is distinct from (old_item->'vat') then
      raise exception 'Pozycja "%" jest już na paragonie – zamiast zmiany zrób zwrot.', old_item->>'name' using errcode = '42501';
    end if;
  end loop;

  for new_item in select value from jsonb_array_elements(new.items) loop
    if coalesce((new_item->>'receipted')::int, 0) > 0 or coalesce((new_item->>'refunded')::int, 0) > 0 then
      if not exists (select 1 from jsonb_array_elements(old.items) as entry where entry->>'id' = new_item->>'id') then
        raise exception 'Nowa pozycja nie może być oznaczona jako zafiskalizowana.' using errcode = '42501';
      end if;
    end if;
  end loop;

  return new;
end;
$function$;

-- Workshop edits: menu items take the product's rate; custom items require one; edit_item may set a missing rate.
create or replace function public.workshop_edit_order(p_order_id uuid, p_action text, p_index integer default null::integer, p_payload jsonb default '{}'::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  actor_role text := coalesce((select private.user_role()), '');
  current_order public.orders%rowtype;
  item jsonb;
  next_items jsonb;
  quantity int := (p_payload->>'quantity')::int;
  options text := left(nullif(trim(coalesce(p_payload->>'options', '')), ''), 200);
  unit_price numeric := round((p_payload->>'unitPrice')::numeric, 2);
  vat text := nullif(p_payload->>'vat', '');
  product public.menu_products%rowtype;
  next_subtotal numeric;
begin
  if actor_role not in ('admin', 'szef', 'kelner') then
    raise exception 'Pozycje zmienia bar.' using errcode = '42501';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Zamówienie nie istnieje.' using errcode = 'P0002';
  end if;
  if current_order.status not in ('new', 'preparing', 'ready') then
    raise exception 'Wydanego zamówienia nie można już zmieniać – możesz zrobić zwrot.' using errcode = '42501';
  end if;
  if quantity is null or quantity < 1 or quantity > 50 then
    raise exception 'Ilość musi wynosić od 1 do 50.' using errcode = '22023';
  end if;
  if unit_price is not null and (unit_price < 0 or unit_price > 10000) then
    raise exception 'Nieprawidłowa cena.' using errcode = '22023';
  end if;
  if vat is not null and vat not in ('A', 'B', 'C', 'D') then
    raise exception 'Nieprawidłowa stawka VAT.' using errcode = '22023';
  end if;

  perform set_config('app.workshop_action', 'on', true);

  case p_action
    when 'edit_item' then
      item := current_order.items -> p_index;
      if item is null or coalesce((item->>'cancelled')::boolean, false) then
        raise exception 'Pozycja nie istnieje.' using errcode = '22023';
      end if;
      item := item
        || jsonb_build_object('quantity', quantity)
        || case when options is null then '{}'::jsonb else jsonb_build_object('options', options) end
        || case when unit_price is null then '{}'::jsonb else jsonb_build_object('unitPrice', unit_price) end
        || case when vat is null then '{}'::jsonb else jsonb_build_object('vat', vat) end
        || case when quantity > (item->>'quantity')::int then jsonb_build_object('done', false) else '{}'::jsonb end;
      if options is null then item := item - 'options'; end if;
      next_items := jsonb_set(current_order.items, array[p_index::text], item);

    when 'add_item' then
      if p_payload ? 'productId' then
        select * into product from public.menu_products where id = p_payload->>'productId';
        if not found then
          raise exception 'Danie nie istnieje w menu.' using errcode = '22023';
        end if;
        item := jsonb_build_object('name', product.name, 'unitPrice', coalesce(unit_price, product.price), 'station', product.station)
          || case when coalesce(product.vat, vat) is null then '{}'::jsonb else jsonb_build_object('vat', coalesce(product.vat, vat)) end;
      else
        if length(trim(coalesce(p_payload->>'name', ''))) < 2 or unit_price is null then
          raise exception 'Podaj nazwę i cenę pozycji.' using errcode = '22023';
        end if;
        if vat is null then
          raise exception 'Wybierz stawkę VAT pozycji.' using errcode = '22023';
        end if;
        item := jsonb_build_object('name', left(trim(p_payload->>'name'), 80), 'unitPrice', unit_price, 'station', case when p_payload->>'station' = 'cashier' then 'cashier' else 'kitchen' end, 'vat', vat);
      end if;
      item := item || jsonb_build_object('id', gen_random_uuid()::text, 'quantity', quantity, 'done', false, 'added', true)
        || case when options is null then '{}'::jsonb else jsonb_build_object('options', options) end;
      next_items := current_order.items || jsonb_build_array(item);

    else
      raise exception 'Nieznana akcja.' using errcode = '22023';
  end case;

  next_subtotal := private.order_subtotal(next_items);
  update public.orders
  set items = next_items,
      subtotal = coalesce(next_subtotal, subtotal),
      total = case when next_subtotal is null then total else greatest(next_subtotal - coalesce(discount, 0), 0) + coalesce(delivery_fee, 0) end
  where id = p_order_id;
end;
$function$;
