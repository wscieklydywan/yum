create table if not exists public.qr_scans (
  id bigint generated always as identity primary key,
  campaign text not null default 'instalacja' check (char_length(campaign) between 1 and 40),
  platform text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  created_at timestamptz not null default now()
);

create index if not exists qr_scans_created_at_idx on public.qr_scans (created_at);
create index if not exists qr_scans_campaign_idx on public.qr_scans (campaign, created_at);

alter table public.qr_scans enable row level security;

create or replace function public.qr_scan_summary(p_month_from timestamptz, p_week_from timestamptz)
returns table (campaign text, total bigint, month bigint, week bigint, ios bigint, android bigint, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.campaign,
    count(*) as total,
    count(*) filter (where s.created_at >= p_month_from) as month,
    count(*) filter (where s.created_at >= p_week_from) as week,
    count(*) filter (where s.platform = 'ios') as ios,
    count(*) filter (where s.platform = 'android') as android,
    max(s.created_at) as last_at
  from public.qr_scans s
  group by s.campaign
  order by count(*) desc;
$$;

revoke all on function public.qr_scan_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.qr_scan_summary(timestamptz, timestamptz) to service_role;
