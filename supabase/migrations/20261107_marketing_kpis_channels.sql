-- Sales split by channel and member/guest, plus marketing cost built from real order discounts
-- (status discount, promotions, codes) and the food cost of wheel prizes and Stars rewards.

create index if not exists orders_created_at_idx on public.orders (created_at);

create or replace function public.marketing_kpis(p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with b0 as (
  select
    (date_trunc('month', p_now at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw') as m_start,
    ((date_trunc('month', p_now at time zone 'Europe/Warsaw') - interval '1 month') at time zone 'Europe/Warsaw') as p_start,
    p_now - interval '30 days' as a_from,
    p_now - interval '60 days' as a_prev,
    p_now - interval '90 days' as r_from
),
b as (select *, least(p_start + (p_now - m_start), m_start) as p_end from b0),
o as (
  select o.customer_id, o.total, o.discount, o.club_savings, o.created_at, coalesce(o.source, 'own') as source
  from orders o, b
  where o.created_at >= least(b.p_start, b.r_from) and o.status <> 'cancelled'
),
act as (
  select t.user_id as id, t.created_at from point_transactions t, b where t.created_at >= b.r_from and t.kind <> 'staff'
  union all
  select o.customer_id, o.created_at from o, b where o.customer_id is not null and o.created_at >= b.r_from
),
seen as (select id, max(created_at) as last_at from act group by id),
cur as (select o.* from o, b where o.created_at >= b.m_start),
prev as (select o.* from o, b where o.created_at >= b.p_start and o.created_at < b.p_end),
cur_c as (select customer_id, count(*) n from cur where customer_id is not null group by 1),
prev_c as (select customer_id, count(*) n from prev where customer_id is not null group by 1),
ev as (
  select e.source, e.amount, e.created_at from marketing_events e, b
  where e.created_at >= b.p_start and e.source in ('wheel', 'reward')
),
members as (
  select p.id, p.created_at, s.last_at
  from profiles p left join seen s on s.id = p.id
  where p.role = 'klient'
)
select jsonb_build_object(
  'period', (select jsonb_build_object('from', m_start, 'previousFrom', p_start, 'previousTo', p_end) from b),
  'sales', jsonb_build_object(
    'revenue', (select coalesce(sum(total), 0) from cur),
    'previous', (select coalesce(sum(total), 0) from prev),
    'orders', (select count(*) from cur),
    'previousOrders', (select count(*) from prev),
    'days', (select count(distinct (created_at at time zone 'Europe/Warsaw')::date) from cur),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'orders', n, 'revenue', r) order by r desc)
      from (select source, count(*) n, sum(total) r from cur group by source) c
    ), '[]'::jsonb)
  ),
  'revenue', jsonb_build_object(
    'value', (select coalesce(sum(total), 0) from cur where customer_id is not null),
    'previous', (select coalesce(sum(total), 0) from prev where customer_id is not null),
    'orders', (select count(*) from cur where customer_id is not null),
    'previousOrders', (select count(*) from prev where customer_id is not null),
    'savings', (select coalesce(sum(club_savings), 0) from cur where customer_id is not null),
    'allOrders', (select count(*) from cur),
    'allRevenue', (select coalesce(sum(total), 0) from cur)
  ),
  'active', jsonb_build_object(
    'value', (select count(*) from seen, b where last_at >= b.a_from),
    'previous', (select count(distinct id) from act, b where created_at >= b.a_prev and created_at < b.a_from),
    'total', (select count(*) from members),
    'newMembers', (select count(*) from members, b where created_at >= b.m_start),
    'buyers', (select count(*) from cur_c)
  ),
  'repeat', jsonb_build_object(
    'customers', (select count(*) from cur_c),
    'repeatCustomers', (select count(*) from cur_c where n > 1),
    'previousCustomers', (select count(*) from prev_c),
    'previousRepeat', (select count(*) from prev_c where n > 1)
  ),
  'cost', jsonb_build_object(
    'discounts', (select coalesce(sum(discount), 0) from cur),
    'clubDiscounts', (select coalesce(sum(club_savings), 0) from cur),
    'wheel', (select coalesce(sum(amount), 0) from ev, b where source = 'wheel' and created_at >= b.m_start),
    'rewards', (select coalesce(sum(amount), 0) from ev, b where source = 'reward' and created_at >= b.m_start),
    'previous', (select coalesce(sum(discount), 0) from prev)
      + (select coalesce(sum(amount), 0) from ev, b where created_at < b.p_end)
  ),
  'lifecycle', (
    select jsonb_build_object(
      'active', count(*) filter (where last_at >= b.a_from),
      'atRisk', count(*) filter (where last_at >= b.r_from and last_at < b.a_from),
      'newInactive', count(*) filter (where (last_at is null or last_at < b.r_from) and created_at >= b.a_from),
      'dormant', count(*) filter (where (last_at is null or last_at < b.r_from) and created_at < b.a_from),
      'total', count(*)
    )
    from members, b
  )
);
$$;

revoke all on function public.marketing_kpis(timestamptz) from public, anon, authenticated;
grant execute on function public.marketing_kpis(timestamptz) to service_role;
