-- Hand-off requires payment only (a receipt is no longer mandatory).
-- A hand-off with a printed receipt cannot be undone – only refunded.
-- Once the working day is closed, finished orders are locked: no undo, restore or refund.
create or replace function public.order_finished_in_closed_day(finished_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select not s.day_open or s.day_opened_at is null or finished_at is null or finished_at < s.day_opened_at
     from public.restaurant_settings s where s.id = 1),
    true
  );
$$;

create or replace function public.enforce_order_handoff_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'handed_off' and new.paid_at is null and coalesce(new.source, '') not in ('glovo', 'pyszne') then
    raise exception 'Nie można wydać nieopłaconego zamówienia.' using errcode = '42501';
  end if;

  if old.status = 'handed_off' and new.status <> 'handed_off' then
    if exists (select 1 from public.order_documents where order_id = new.id and kind = 'receipt' and status = 'printed') then
      raise exception 'Paragon jest wydany – zamiast cofać wydanie, zrób zwrot.' using errcode = '42501';
    end if;
    if public.order_finished_in_closed_day(old.handed_off_at) then
      raise exception 'Dzień pracy został zamknięty – nie można już cofnąć wydania.' using errcode = '42501';
    end if;
  end if;

  if old.status = 'cancelled' and new.status <> 'cancelled' and public.order_finished_in_closed_day(old.cancelled_at) then
    raise exception 'Dzień pracy został zamknięty – nie można już przywrócić zamówienia.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_refund_day_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
begin
  if new.kind <> 'refund' then
    return new;
  end if;
  select status, handed_off_at, cancelled_at into o from public.orders where id = new.order_id;
  if o.status in ('handed_off', 'cancelled')
     and public.order_finished_in_closed_day(case when o.status = 'handed_off' then o.handed_off_at else o.cancelled_at end) then
    raise exception 'Dzień pracy został zamknięty – zwrot nie jest już możliwy.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists order_documents_refund_day_lock on public.order_documents;
create trigger order_documents_refund_day_lock
before insert on public.order_documents
for each row execute function public.enforce_refund_day_lock();
