-- Records when a device last started printing the pending receipt, so other screens can show
-- "Drukowanie…" for a short while instead of offering a concurrent retry.
alter table public.orders add column if not exists pending_receipt_at timestamptz;

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
         pending_receipt_id = case when p_document->>'kind' = 'receipt' then (p_document->>'id')::uuid else pending_receipt_id end,
         pending_receipt_at = case when p_document->>'kind' = 'receipt' then now() else pending_receipt_at end
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

create or replace function public.workshop_mark_document_printing(p_document_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);
  update public.orders set pending_receipt_at = now() where pending_receipt_id = p_document_id;
end;
$function$;

revoke all on function public.workshop_mark_document_printing(uuid) from public, anon, authenticated;

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
    'paid_at', 'receipt_payment_method', 'cash_received_grosze', 'payment_split', 'buyer_nip', 'pending_receipt_id',
    'pending_receipt_at'
  ])
$function$;
