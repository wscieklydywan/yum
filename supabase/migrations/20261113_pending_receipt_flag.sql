-- Marks orders whose receipt was issued (items reserved) but never confirmed as printed,
-- so the workshop card can show it and offer a retry after the settle dialog is closed.
alter table public.orders add column if not exists pending_receipt_id uuid;

create or replace function public.workshop_store_document(p_order_id uuid, p_expected_items jsonb, p_items jsonb, p_document jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);

  update public.orders
     set items = p_items,
         pending_receipt_id = case when p_document->>'kind' = 'receipt' then (p_document->>'id')::uuid else pending_receipt_id end
   where id = p_order_id and items = p_expected_items;
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
$function$;

create or replace function public.workshop_finish_document(p_document_id uuid, p_status text, p_expected_items jsonb default null, p_items jsonb default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  document public.order_documents%rowtype;
begin
  select * into document from public.order_documents where id = p_document_id for update;
  if not found or document.status <> 'pending' then
    raise exception 'Dokument nie oczekuje na wydruk.' using errcode = '22023';
  end if;

  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);

  if p_status = 'printed' then
    update public.order_documents set status = 'printed', printed_at = now() where id = p_document_id;
    update public.orders set pending_receipt_id = null where id = document.order_id and pending_receipt_id = p_document_id;
  elsif p_status = 'void' then
    update public.orders
       set items = p_items,
           pending_receipt_id = case when pending_receipt_id = p_document_id then null else pending_receipt_id end
     where id = document.order_id and items = p_expected_items;
    if not found then
      raise exception 'Zamówienie zmieniło się w międzyczasie. Spróbuj ponownie.' using errcode = '40001';
    end if;
    update public.order_documents set status = 'void' where id = p_document_id;
  else
    raise exception 'Nieznany status.' using errcode = '22023';
  end if;
end;
$function$;

create or replace function private.workshop_order_row(o public.orders)
 returns jsonb
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  from jsonb_each(to_jsonb(o)) e
  where e.key = any (array[
    'id', 'number', 'status', 'type', 'customer', 'phone', 'address', 'postcode', 'items', 'note', 'eta',
    'scheduled_for', 'paused', 'handed_off', 'created_at', 'ready_at', 'handed_off_at', 'cancelled_at',
    'cancelled_from', 'cancel_reason', 'source', 'discount', 'delivery_fee', 'total', 'payment_method',
    'paid_at', 'receipt_payment_method', 'cash_received_grosze', 'payment_split', 'buyer_nip', 'pending_receipt_id'
  ])
$function$;

do $$
begin
  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);
  update public.orders o
     set pending_receipt_id = d.id
    from public.order_documents d
   where d.order_id = o.id and d.kind = 'receipt' and d.status = 'pending';
end $$;
