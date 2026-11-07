-- Every fiscal daily report (POSNET "dailyrep") is recorded, so the system knows during the day
-- whether it was done and can require it – together with the cash report – before the next day opens.
create table if not exists public.fiscal_daily_reports (
  id uuid primary key default gen_random_uuid(),
  printed_at timestamptz not null default now(),
  source text not null check (source in ('posnet', 'manual')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fiscal_daily_reports_printed_at_idx on public.fiscal_daily_reports (printed_at desc);
create index if not exists cash_reports_period_to_idx on public.cash_reports (period_to desc);

alter table public.fiscal_daily_reports enable row level security;
-- No policies: accessed only through the server with the service role.
revoke all on public.fiscal_daily_reports from anon, authenticated;

-- 24.10 the daily report was printed on the till, but nothing recorded it yet.
insert into public.fiscal_daily_reports (printed_at, source, note)
select '2026-10-24T20:04:00+00', 'manual', 'Uzupełnione wstecznie – raport wydrukowany na kasie'
where not exists (select 1 from public.fiscal_daily_reports where printed_at >= '2026-10-24T08:56:01+00' and printed_at < '2026-10-25T08:00:00+00');
