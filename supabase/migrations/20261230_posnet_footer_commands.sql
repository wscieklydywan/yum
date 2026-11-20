-- Already applied in Supabase as version 20261108234013 (posnet_footer_commands); kept here so the repo matches the database.
alter table public.posnet_non_fiscal_settings
  add column if not exists commands jsonb;
