-- Zestawienie kosztów marketingu dla panelu warsztatu (wywoływane tylko kluczem serwisowym).

create or replace function public.marketing_cost_summary(p_from timestamptz)
returns table (source text, ref_id text, label text, uses bigint, total numeric, period_uses bigint, period_total numeric)
language sql
stable
security definer
set search_path to ''
as $$
  select
    e.source,
    e.ref_id,
    (array_agg(e.label order by e.created_at desc))[1] as label,
    count(*) as uses,
    coalesce(sum(e.amount), 0) as total,
    count(*) filter (where e.created_at >= p_from) as period_uses,
    coalesce(sum(e.amount) filter (where e.created_at >= p_from), 0) as period_total
  from public.marketing_events e
  group by e.source, e.ref_id;
$$;

revoke execute on function public.marketing_cost_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.marketing_cost_summary(timestamptz) to service_role;
