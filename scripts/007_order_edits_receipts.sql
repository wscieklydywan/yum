-- Korekty zamówień, paragony i zwroty.
-- Pozycja w orders.items dostaje stałe "id" oraz liczniki:
--   receipted – ile sztuk jest już na paragonie (wydrukowanym lub w trakcie druku),
--   refunded  – ile sztuk z paragonu zwrócono (protokół zwrotu).
-- Zafiskalizowanej pozycji nie można anulować, przecenić ani zmniejszyć poniżej "receipted" – tylko zwrot.

-- 1. Stałe ID pozycji (paragon i zwrot wskazują pozycję po ID, nie po indeksie)
create or replace function private.normalize_order_items(p_items jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    item
      || jsonb_build_object(
        'id', coalesce(item->>'id', gen_random_uuid()::text),
        'station', coalesce(item->>'station', (select m.station from public.menu_products m where m.name = item->>'name' limit 1), 'kitchen'),
        'done', coalesce((item->>'done')::boolean, false)
      )
    order by ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entries(item, ordinality);
$$;

alter table public.orders disable trigger enforce_order_role_changes;
update public.orders
set items = (
  select jsonb_agg(case when entry ? 'id' then entry else entry || jsonb_build_object('id', gen_random_uuid()::text) end order by ordinality)
  from jsonb_array_elements(items) with ordinality as entries(entry, ordinality)
)
where jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
  and exists (select 1 from jsonb_array_elements(items) as entry where not entry ? 'id');
alter table public.orders enable trigger enforce_order_role_changes;

-- 2. Ochrona pozycji zafiskalizowanych (działa dla każdej ścieżki: RPC, polityki RLS, panel)
create or replace function private.protect_receipted_items()
returns trigger
language plpgsql
set search_path = ''
as $$
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
      or (new_item->'options') is distinct from (old_item->'options') then
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
$$;

drop trigger if exists protect_receipted_items on public.orders;
create trigger protect_receipted_items
  before update of items on public.orders
  for each row execute function private.protect_receipted_items();

-- 3. Sumy zamówienia liczone z pozycji (tylko gdy każda aktywna pozycja ma cenę)
create or replace function private.order_subtotal(p_items jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when bool_and(item ? 'unitPrice') then round(sum((item->>'unitPrice')::numeric * ((item->>'quantity')::int - coalesce((item->>'refunded')::int, 0))), 2)
  end
  from jsonb_array_elements(p_items) as item
  where not coalesce((item->>'cancelled')::boolean, false);
$$;

-- 4. Korekty zamówienia z kasy: edycja i dopisanie pozycji
create or replace function public.workshop_edit_order(
  p_order_id uuid,
  p_action text,
  p_index int default null,
  p_payload jsonb default '{}'::jsonb
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
  next_items jsonb;
  quantity int := (p_payload->>'quantity')::int;
  options text := left(nullif(trim(coalesce(p_payload->>'options', '')), ''), 200);
  unit_price numeric := round((p_payload->>'unitPrice')::numeric, 2);
  product public.menu_products%rowtype;
  next_subtotal numeric;
begin
  if actor_role not in ('admin', 'kelner') then
    raise exception 'Pozycje zmienia kasa.' using errcode = '42501';
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
        || case when quantity > (item->>'quantity')::int then jsonb_build_object('done', false) else '{}'::jsonb end;
      if options is null then item := item - 'options'; end if;
      next_items := jsonb_set(current_order.items, array[p_index::text], item);

    when 'add_item' then
      if p_payload ? 'productId' then
        select * into product from public.menu_products where id = p_payload->>'productId';
        if not found then
          raise exception 'Danie nie istnieje w menu.' using errcode = '22023';
        end if;
        item := jsonb_build_object('name', product.name, 'unitPrice', coalesce(unit_price, product.price), 'station', product.station);
      else
        if length(trim(coalesce(p_payload->>'name', ''))) < 2 or unit_price is null then
          raise exception 'Podaj nazwę i cenę pozycji.' using errcode = '22023';
        end if;
        item := jsonb_build_object('name', left(trim(p_payload->>'name'), 80), 'unitPrice', unit_price, 'station', case when p_payload->>'station' = 'cashier' then 'cashier' else 'kitchen' end);
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
$$;

revoke all on function public.workshop_edit_order(uuid, text, int, jsonb) from public, anon;
grant execute on function public.workshop_edit_order(uuid, text, int, jsonb) to authenticated;

-- 5. Rejestr dokumentów: paragony i protokoły zwrotu
create table if not exists public.order_documents (
  id uuid primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('receipt', 'refund')),
  status text not null default 'pending' check (status in ('pending', 'printed', 'void')),
  payload jsonb not null,
  total_grosze int not null check (total_grosze >= 0),
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create index if not exists order_documents_order_idx on public.order_documents (order_id, created_at);
create unique index if not exists order_documents_one_pending_receipt on public.order_documents (order_id) where kind = 'receipt' and status = 'pending';

alter table public.order_documents enable row level security;
drop policy if exists order_documents_staff_select on public.order_documents;
create policy order_documents_staff_select on public.order_documents
  for select to authenticated
  using ((select private.user_role()) in ('admin', 'kelner'));

-- Zapis dokumentu i liczników pozycji w jednej transakcji, z kontrolą współbieżności (p_expected_items).
-- Wywołuje wyłącznie serwer aplikacji (service_role), który sam wylicza paragon z danych w bazie.
create or replace function public.workshop_store_document(
  p_order_id uuid,
  p_expected_items jsonb,
  p_items jsonb,
  p_document jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);

  update public.orders set items = p_items where id = p_order_id and items = p_expected_items;
  if not found then
    raise exception 'Zamówienie zmieniło się w międzyczasie. Spróbuj ponownie.' using errcode = '40001';
  end if;

  insert into public.order_documents (id, order_id, kind, payload, total_grosze, reason, created_by)
  values (
    (p_document->>'id')::uuid,
    p_order_id,
    p_document->>'kind',
    p_document->'payload',
    (p_document->>'total')::int,
    nullif(p_document->>'reason', ''),
    nullif(p_document->>'createdBy', '')::uuid
  );
end;
$$;

create or replace function public.workshop_finish_document(
  p_document_id uuid,
  p_status text,
  p_expected_items jsonb default null,
  p_items jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  document public.order_documents%rowtype;
begin
  select * into document from public.order_documents where id = p_document_id for update;
  if not found or document.status <> 'pending' then
    raise exception 'Dokument nie oczekuje na wydruk.' using errcode = '22023';
  end if;

  if p_status = 'printed' then
    update public.order_documents set status = 'printed', printed_at = now() where id = p_document_id;
  elsif p_status = 'void' then
    perform set_config('app.receipt_action', 'on', true);
    perform set_config('app.workshop_action', 'on', true);
    update public.orders set items = p_items where id = document.order_id and items = p_expected_items;
    if not found then
      raise exception 'Zamówienie zmieniło się w międzyczasie. Spróbuj ponownie.' using errcode = '40001';
    end if;
    update public.order_documents set status = 'void' where id = p_document_id;
  else
    raise exception 'Nieznany status.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.workshop_store_document(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.workshop_finish_document(uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.workshop_store_document(uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.workshop_finish_document(uuid, text, jsonb, jsonb) to service_role;
