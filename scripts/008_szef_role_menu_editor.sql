-- Rola "szef": uprawnienia administratora bez możliwości zarządzania administratorami
-- (ograniczenie dotyczące administratorów egzekwuje /api/workshop/users).

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin', 'szef', 'kuchnia', 'kelner', 'klient', 'kierowca']));

create or replace function private.is_manager()
returns boolean
language sql
stable security definer
set search_path to ''
as $$ select coalesce((select role from public.profiles where id = (select auth.uid())) in ('admin', 'szef'), false) $$;

-- Funkcje RPC: wszędzie, gdzie dopuszczony jest admin, dopuszczamy też szefa.
do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and p.prosrc like '%''admin''%' and p.prosrc not like '%''szef''%'
      and p.proname <> 'is_manager'
  loop
    definition := pg_get_functiondef(fn.oid);
    definition := replace(definition, '''admin'', ', '''admin'', ''szef'', ');
    definition := replace(definition, '''admin'',''', '''admin'',''szef'',''');
    execute definition;
  end loop;
end $$;

-- Polityki RLS
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select
  using (((select auth.uid()) = id) or (select private.user_role()) in ('admin', 'szef'));

drop policy if exists menu_categories_admin_write on public.menu_categories;
create policy menu_categories_admin_write on public.menu_categories for all
  using ((select private.user_role()) in ('admin', 'szef'))
  with check ((select private.user_role()) in ('admin', 'szef'));

drop policy if exists menu_products_admin_insert on public.menu_products;
create policy menu_products_admin_insert on public.menu_products for insert
  with check ((select private.user_role()) in ('admin', 'szef'));

drop policy if exists menu_products_admin_delete on public.menu_products;
create policy menu_products_admin_delete on public.menu_products for delete
  using ((select private.user_role()) in ('admin', 'szef'));

drop policy if exists menu_products_staff_update on public.menu_products;
create policy menu_products_staff_update on public.menu_products for update
  using ((select private.user_role()) in ('admin', 'szef', 'kuchnia'))
  with check ((select private.user_role()) in ('admin', 'szef', 'kuchnia'));

drop policy if exists orders_staff_or_owner_select on public.orders;
create policy orders_staff_or_owner_select on public.orders for select
  using (
    (select private.user_role()) in ('admin', 'szef', 'kuchnia', 'kelner')
    or ((select private.user_role()) = 'kierowca' and type = 'Dostawa')
    or customer_id = (select auth.uid())
  );

drop policy if exists orders_kitchen_update on public.orders;
create policy orders_kitchen_update on public.orders for update
  using ((select private.user_role()) in ('admin', 'szef', 'kuchnia'))
  with check ((select private.user_role()) in ('admin', 'szef', 'kuchnia'));

drop policy if exists orders_kitchen_delete on public.orders;
create policy orders_kitchen_delete on public.orders for delete
  using ((select private.user_role()) in ('admin', 'szef', 'kuchnia'));

drop policy if exists order_documents_staff_select on public.order_documents;
create policy order_documents_staff_select on public.order_documents for select
  using ((select private.user_role()) in ('admin', 'szef', 'kelner'));

-- Zdjęcia pozycji menu (WebP, wgrywane przez API warsztatu kluczem serwisowym)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp'];
