-- Rolling 7-day comparison used when the previous calendar month cannot be a baseline yet
-- (e.g. the system started mid-month). Reads only the last ~37 days through the created_at indexes.

create or replace function public.marketing_week_kpis(p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with b as (
  select
    p_now - interval '7 days' as w_from,
    p_now - interval '14 days' as w_prev,
    p_now - interval '37 days' as a_prev
),
o as (
  select o.customer_id, o.total, o.discount, o.created_at
  from orders o, b
  where o.created_at >= least(b.w_prev, b.a_prev) and o.status <> 'cancelled'
),
act as (
  select t.user_id as id, t.created_at from point_transactions t, b where t.created_at >= b.a_prev and t.kind <> 'staff'
  union all
  select o.customer_id, o.created_at from o where o.customer_id is not null
),
ev as (
  select e.amount, e.created_at from marketing_events e, b
  where e.created_at >= b.w_prev and e.source = 'reward'
)
select jsonb_build_object(
  'firstOrderAt', (select min(created_at) from orders),
  'window', (select jsonb_build_object('from', w_from, 'previousFrom', w_prev, 'activePreviousFrom', a_prev) from b),
  'sales', jsonb_build_object(
    'value', (select coalesce(sum(total), 0) from o, b where created_at >= b.w_from),
    'previous', (select coalesce(sum(total), 0) from o, b where created_at >= b.w_prev and created_at < b.w_from),
    'orders', (select count(*) from o, b where created_at >= b.w_from),
    'previousOrders', (select count(*) from o, b where created_at >= b.w_prev and created_at < b.w_from)
  ),
  'discounts', jsonb_build_object(
    'value', (select coalesce(sum(discount), 0) from o, b where created_at >= b.w_from),
    'previous', (select coalesce(sum(discount), 0) from o, b where created_at >= b.w_prev and created_at < b.w_from)
  ),
  'rewards', jsonb_build_object(
    'value', (select coalesce(sum(amount), 0) from ev, b where created_at >= b.w_from),
    'previous', (select coalesce(sum(amount), 0) from ev, b where created_at < b.w_from)
  ),
  'activeWeekAgo', (select count(distinct id) from act, b where created_at < b.w_from)
);
$$;

revoke all on function public.marketing_week_kpis(timestamptz) from public, anon, authenticated;
grant execute on function public.marketing_week_kpis(timestamptz) to service_role;
