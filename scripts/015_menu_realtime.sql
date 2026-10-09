-- Broadcast menu changes (e.g. a dish switched off by the kitchen) to every open client in real time.
do $$
declare
  t text;
begin
  foreach t in array array['menu_products', 'menu_categories', 'menu_product_variants', 'menu_modifier_options', 'menu_modifier_groups'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
