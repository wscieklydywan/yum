grant delete on public.orders to authenticated;

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete on public.orders
  for delete to authenticated
  using ((select private.user_role()) = any (array['admin', 'szef']));

revoke all on public.cash_reports from anon;
revoke all on public.day_reports from anon;
revoke all on public.promo_codes from anon;
