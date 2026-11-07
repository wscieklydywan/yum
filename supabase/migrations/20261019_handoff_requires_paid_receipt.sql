-- An order can be handed off only when it is paid and has a printed receipt.
-- Once a printed receipt exists, a hand-off cannot be undone – only refunded.
create or replace function public.enforce_order_handoff_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_printed_receipt boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select exists (
    select 1 from public.order_documents
    where order_id = new.id and kind = 'receipt' and status = 'printed'
  ) into has_printed_receipt;

  if new.status = 'handed_off' then
    if new.paid_at is null and coalesce(new.source, '') not in ('glovo', 'pyszne') then
      raise exception 'Nie można wydać nieopłaconego zamówienia.' using errcode = '42501';
    end if;
    if not has_printed_receipt then
      raise exception 'Nie można wydać zamówienia bez wydrukowanego paragonu.' using errcode = '42501';
    end if;
  end if;

  if old.status = 'handed_off' and new.status <> 'handed_off' and has_printed_receipt then
    raise exception 'Paragon jest wydany – zamiast cofać wydanie, zrób zwrot.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_handoff_rules on public.orders;
create trigger orders_handoff_rules
before update of status on public.orders
for each row execute function public.enforce_order_handoff_rules();
