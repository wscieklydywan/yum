-- Zliczanie zakręceń kołem po nagrodzie w bazie zamiast ściągania do 50 000 wierszy do Node.
create index if not exists marketing_events_source_created_idx on public.marketing_events (source, created_at);

create or replace function public.wheel_spin_counts(p_from timestamptz, p_previous_from timestamptz, p_previous_to timestamptz)
returns table (ref_id text, current_spins bigint, previous_spins bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.ref_id::text,
    count(*) filter (where e.created_at >= p_from) as current_spins,
    count(*) filter (where e.created_at >= p_previous_from and e.created_at < p_previous_to) as previous_spins
  from public.marketing_events e
  where e.source = 'wheel' and e.created_at >= least(p_from, p_previous_from)
  group by e.ref_id;
$$;

revoke all on function public.wheel_spin_counts(timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.wheel_spin_counts(timestamptz, timestamptz, timestamptz) to service_role;
