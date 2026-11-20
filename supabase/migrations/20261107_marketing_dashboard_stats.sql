-- Marketing dashboard aggregates computed in Postgres (one round trip, no row paging in Node).

create index if not exists point_transactions_created_idx on public.point_transactions (created_at);
create index if not exists reward_redemptions_created_idx on public.reward_redemptions (created_at);
create index if not exists promo_code_uses_created_idx on public.promo_code_uses (created_at);
create index if not exists marketing_events_created_idx on public.marketing_events (created_at);

-- Headline numbers for the dashboard: month to date vs the same elapsed slice of the previous month.
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
  select o.customer_id, o.total, o.club_savings, o.created_at
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
members as (
  select p.id, p.created_at, s.last_at
  from profiles p left join seen s on s.id = p.id
  where p.role = 'klient'
)
select jsonb_build_object(
  'period', (select jsonb_build_object('from', m_start, 'previousFrom', p_start, 'previousTo', p_end) from b),
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
    'value', (select coalesce(sum(e.amount), 0) from marketing_events e, b where e.created_at >= b.m_start),
    'previous', (select coalesce(sum(e.amount), 0) from marketing_events e, b where e.created_at >= b.p_start and e.created_at < b.p_end)
  ),
  -- Exclusive segments that add up to the whole club. "Nowi" are only members who joined recently and have not done anything yet.
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

-- Detailed analytics for the statistics view.
create or replace function public.marketing_stats(p_silver integer, p_gold integer, p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with b as (
  select
    p_now - interval '31 days' as since,
    p_now - interval '30 days' as a_from,
    (date_trunc('month', p_now at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw') as m_start,
    (p_now at time zone 'Europe/Warsaw')::date as today
),
days as (select (b.today - g)::date as d from b, generate_series(0, 29) g),
ev as (
  select (t.created_at at time zone 'Europe/Warsaw')::date as d, t.user_id as id
  from point_transactions t, b where t.created_at >= b.since and t.kind <> 'staff' and t.amount > 0
  union
  select (o.created_at at time zone 'Europe/Warsaw')::date, o.customer_id
  from orders o, b where o.created_at >= b.since and o.status <> 'cancelled' and o.customer_id is not null
),
ev_day as (select d, count(*) as n from ev group by d),
od as (
  select (o.created_at at time zone 'Europe/Warsaw')::date as d,
    count(*) filter (where o.customer_id is not null) as club,
    count(*) as total_orders,
    coalesce(sum(o.total) filter (where o.customer_id is not null), 0) as revenue
  from orders o, b where o.created_at >= b.since and o.status <> 'cancelled'
  group by 1
),
tx as (select t.amount, t.kind from point_transactions t, b where t.created_at >= b.a_from and t.kind <> 'staff'),
top as (
  select r.reward as name, count(*) as n, coalesce(sum(r.cost), 0) as stars
  from reward_redemptions r, b where r.created_at >= b.a_from
  group by r.reward order by n desc, name limit 5
)
select jsonb_build_object(
  'activity', (
    select jsonb_agg(jsonb_build_object(
      'date', days.d,
      'customers', coalesce(ev_day.n, 0),
      'orders', coalesce(od.club, 0),
      'allOrders', coalesce(od.total_orders, 0),
      'revenue', coalesce(od.revenue, 0)
    ) order by days.d)
    from days left join ev_day on ev_day.d = days.d left join od on od.d = days.d
  ),
  'tiers', (
    select jsonb_build_object(
      'gold', count(*) filter (where coalesce(status_points, 0) >= p_gold),
      'silver', count(*) filter (where coalesce(status_points, 0) >= p_silver and coalesce(status_points, 0) < p_gold),
      'fan', count(*) filter (where coalesce(status_points, 0) < p_silver),
      'balance', coalesce(sum(points), 0)
    )
    from profiles where role = 'klient'
  ),
  'stars', jsonb_build_object(
    'earned', (select coalesce(sum(amount), 0) from tx where amount > 0 and kind <> 'refund'),
    'redeemed', (select coalesce(-sum(amount), 0) from tx where amount < 0 and kind in ('redeem', 'spin_cost'))
  ),
  'claimedRewards', (select count(*) from reward_redemptions r, b where r.created_at >= b.m_start),
  'claimedCodes', (select count(*) from promo_code_uses u, b where u.created_at >= b.m_start),
  'topRewards', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'count', n, 'stars', stars) order by n desc, name) from top), '[]'::jsonb)
);
$$;

revoke all on function public.marketing_kpis(timestamptz) from public, anon, authenticated;
revoke all on function public.marketing_stats(integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.marketing_kpis(timestamptz) to service_role;
grant execute on function public.marketing_stats(integer, integer, timestamptz) to service_role;
