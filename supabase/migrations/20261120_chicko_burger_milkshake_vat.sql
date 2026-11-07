-- CHICKO moves to BURGERY and gets the standard burger add-ons (same as Sztoser Kurka).
update public.menu_products c
   set category_id = 'burgery',
       extras = b.extras
  from public.menu_products b
 where c.id = 'd3e553c6-6bcf-11eb-bdef-525400080521'
   and b.id = 'dae6fc20-a38c-11f1-8d3d-525400080621';

-- Milkshakes are taxed at 8% (B), not 23% (A).
update public.menu_products set vat = 'B' where category_id = 'milkshake';

-- Order #1253: the 23% receipt is withdrawn so it can be issued again at 8%.
do $$
declare
  target public.orders%rowtype;
begin
  select * into target from public.orders where number = 1253 for update;
  if not found then
    return;
  end if;

  perform set_config('app.receipt_action', 'on', true);
  perform set_config('app.workshop_action', 'on', true);

  update public.order_documents
     set status = 'void'
   where order_id = target.id and kind = 'receipt' and status = 'printed';

  update public.orders
     set items = (
           select jsonb_agg(
             item || jsonb_build_object('receipted', 0)
                  || case when item->>'name' ilike '%milkshake%' then jsonb_build_object('vat', 'B') else '{}'::jsonb end
             order by ordinality)
           from jsonb_array_elements(target.items) with ordinality as entries(item, ordinality)
         ),
         receipt_payment_method = null,
         pending_receipt_id = null
   where id = target.id;
end $$;
