-- Diagnostic log of POSNET print attempts (written by /api/workshop/printer-logs via the service role only).
create table if not exists public.printer_log_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  document_id uuid references public.order_documents(id) on delete set null,
  order_number integer,
  document_kind text check (document_kind in ('receipt', 'refund')),
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result text not null default 'in_progress' check (result in ('in_progress', 'succeeded', 'failed', 'already_printed', 'unknown')),
  failure_command text,
  error_code text,
  error_message text,
  transaction_open boolean,
  transaction_type text,
  fiscal_ended boolean,
  print_completed boolean,
  fiscalized boolean,
  printer_connected boolean,
  application_status text check (application_status in ('pending', 'printed', 'void')),
  application_status_error text,
  created_at timestamptz not null default now()
);

create index if not exists printer_log_attempts_document_idx on public.printer_log_attempts (document_id, started_at desc);
create index if not exists printer_log_attempts_order_idx on public.printer_log_attempts (order_id, started_at desc);
create index if not exists printer_log_attempts_started_idx on public.printer_log_attempts (started_at desc);
create index if not exists printer_log_attempts_created_by_idx on public.printer_log_attempts (created_by);

create table if not exists public.printer_log_entries (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.printer_log_attempts(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  event_type text not null check (event_type in ('attempt_started', 'connection', 'command')),
  command_name text,
  parameters jsonb not null default '{}'::jsonb,
  raw_response text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer check (duration_ms >= 0),
  sent boolean,
  outcome text not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (attempt_id, sequence)
);

alter table public.printer_log_attempts enable row level security;
alter table public.printer_log_entries enable row level security;
revoke all on public.printer_log_attempts, public.printer_log_entries from anon, authenticated;
