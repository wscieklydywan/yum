-- Supabase advisor fixes before importing ~5k customers.
-- "Unused" indexes on orders/profiles/reward_redemptions/marketing_events are kept on purpose:
-- they are unused only because the table is nearly empty today, and they back customer history,
-- admin customer search/pagination, scheduled orders and the unique phone constraint.

-- 1. Indexes for foreign keys (joins on menu load, user deletes, per-user lookups).
create index if not exists cash_reports_created_by_idx on public.cash_reports (created_by);
create index if not exists day_reports_closed_by_idx on public.day_reports (closed_by);
create index if not exists day_reports_opened_by_idx on public.day_reports (opened_by);
create index if not exists marketing_events_user_id_idx on public.marketing_events (user_id);
create index if not exists menu_modifier_options_group_id_idx on public.menu_modifier_options (group_id);
create index if not exists menu_product_modifier_groups_group_id_idx on public.menu_product_modifier_groups (group_id);
create index if not exists menu_product_variants_product_id_idx on public.menu_product_variants (product_id);
create index if not exists menu_products_category_id_idx on public.menu_products (category_id);
create index if not exists order_documents_created_by_idx on public.order_documents (created_by);
create index if not exists promo_code_uses_user_id_idx on public.promo_code_uses (user_id);
create index if not exists promo_codes_product_id_idx on public.promo_codes (product_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists restaurant_settings_day_opened_by_idx on public.restaurant_settings (day_opened_by);
create index if not exists wheel_prizes_product_id_idx on public.wheel_prizes (product_id);

-- 2. menu_categories: the admin "ALL" policy also applied to SELECT, so every public menu read
--    evaluated two policies. Split it into write-only policies.
drop policy if exists menu_categories_admin_write on public.menu_categories;

create policy menu_categories_admin_insert on public.menu_categories
  for insert to authenticated
  with check ((select private.user_role()) = any (array['admin', 'szef']));

create policy menu_categories_admin_update on public.menu_categories
  for update to authenticated
  using ((select private.user_role()) = any (array['admin', 'szef']))
  with check ((select private.user_role()) = any (array['admin', 'szef']));

create policy menu_categories_admin_delete on public.menu_categories
  for delete to authenticated
  using ((select private.user_role()) = any (array['admin', 'szef']));

-- 3. orders UPDATE: merge the staff and driver policies into one (identical semantics:
--    permissive policies are OR-ed for both USING and WITH CHECK).
drop policy if exists orders_kitchen_update on public.orders;
drop policy if exists orders_driver_handoff on public.orders;

create policy orders_staff_update on public.orders
  for update to authenticated
  using (
    (select private.user_role()) = any (array['admin', 'szef', 'kuchnia'])
    or (
      (select private.user_role()) = 'kierowca'
      and type = 'Dostawa' and status = 'ready' and not handed_off
    )
  )
  with check (
    (select private.user_role()) = any (array['admin', 'szef', 'kuchnia'])
    or (
      (select private.user_role()) = 'kierowca'
      and type = 'Dostawa' and status = 'ready' and handed_off and handed_off_at is not null
    )
  );

-- 4. Trigger functions must not be callable through /rest/v1/rpc (triggers still fire).
revoke execute on function public.enforce_order_handoff_rules() from public, anon, authenticated;
revoke execute on function public.enforce_refund_day_lock() from public, anon, authenticated;
