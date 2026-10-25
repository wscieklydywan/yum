-- VAT rates for packaging and delivery, chosen in Warsztat → Ustawienia (default B = 8%, as before).
-- Packaging items get the rate stamped when they are added to an order; delivery takes it when the receipt is issued.
alter table public.restaurant_settings add column if not exists packaging_vat text not null default 'B';
alter table public.restaurant_settings add column if not exists delivery_vat text not null default 'B';
alter table public.restaurant_settings drop constraint if exists restaurant_settings_packaging_vat_check;
alter table public.restaurant_settings add constraint restaurant_settings_packaging_vat_check check (packaging_vat in ('A', 'B', 'C', 'D'));
alter table public.restaurant_settings drop constraint if exists restaurant_settings_delivery_vat_check;
alter table public.restaurant_settings add constraint restaurant_settings_delivery_vat_check check (delivery_vat in ('A', 'B', 'C', 'D'));

-- Fiscal printers (POSNET) accept item names up to ~40 characters. Every name that can become a receipt line is capped at 40.
alter table public.menu_products drop constraint if exists menu_products_name_length_check;
alter table public.menu_products add constraint menu_products_name_length_check check (char_length(name) <= 40);
alter table public.menu_product_variants drop constraint if exists menu_product_variants_name_length_check;
alter table public.menu_product_variants add constraint menu_product_variants_name_length_check check (char_length(name) <= 40);
alter table public.menu_modifier_options drop constraint if exists menu_modifier_options_name_length_check;
alter table public.menu_modifier_options add constraint menu_modifier_options_name_length_check check (char_length(name) <= 40);

-- Custom bar items: 40 characters instead of 80.
do $$
declare
  source text;
  name_80_pattern constant text := 'left\s*\(\s*trim\s*\(\s*p_payload\s*->>\s*''name''(?:::text)?\s*\)\s*,\s*80\s*\)';
  name_40_pattern constant text := 'left\s*\(\s*trim\s*\(\s*p_payload\s*->>\s*''name''(?:::text)?\s*\)\s*,\s*40\s*\)';
begin
  select pg_get_functiondef('public.workshop_edit_order(uuid, text, integer, jsonb)'::regprocedure) into source;
  if source ~ name_80_pattern then
    source := regexp_replace(source, name_80_pattern, 'left(trim(p_payload ->> ''name''), 40)', 'g');
  elsif source !~ name_40_pattern then
    raise exception 'Could not find the custom order item name limit in workshop_edit_order.';
  end if;
  execute source;
end $$;
