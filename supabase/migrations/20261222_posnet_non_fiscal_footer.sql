create table if not exists public.posnet_non_fiscal_settings (
  id smallint primary key default 1 check (id = 1),
  settings jsonb not null default '{"lines":["Dziękujemy za zamówienie!"],"qrTemplate":""}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.posnet_non_fiscal_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.posnet_non_fiscal_settings enable row level security;
revoke all on table public.posnet_non_fiscal_settings from anon, authenticated;
