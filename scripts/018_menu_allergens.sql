alter table public.menu_products add column if not exists allergens text[] not null default '{}';
notify pgrst, 'reload schema';
