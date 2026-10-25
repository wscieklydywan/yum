-- Stanowisko "Kasa" zostało przemianowane na "Bar".
-- Wewnętrzny kod stanowiska pozostaje 'cashier' (wyświetlany jako "Bar"); usuwamy zbędny duplikat 'bar'.

update public.menu_products set station = 'cashier' where station = 'bar';

alter table public.menu_products drop constraint if exists menu_products_station_check;
alter table public.menu_products
  add constraint menu_products_station_check check (station in ('kitchen', 'cashier'));

-- Komunikaty błędów w funkcjach RPC: "kasa" -> "bar"
do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('workshop_order_action', 'workshop_edit_order')
  loop
    definition := pg_get_functiondef(fn.oid);
    definition := replace(definition, 'Problem rozwiązuje kasa.', 'Problem rozwiązuje bar.');
    definition := replace(definition, 'Pozycję anuluje kasa.', 'Pozycję anuluje bar.');
    definition := replace(definition, 'Zamówienie anuluje kasa.', 'Zamówienie anuluje bar.');
    definition := replace(definition, 'Pozycje zmienia kasa.', 'Pozycje zmienia bar.');
    execute definition;
  end loop;
end $$;
