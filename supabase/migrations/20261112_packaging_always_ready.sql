-- Packaging and price surcharge lines are never prepared by a station, so they always count as ready.
create or replace function private.orders_workflow()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  active_count int;
  done_count int;
begin
  if tg_op = 'INSERT' then
    new.items := private.normalize_order_items(new.items);
  end if;

  if new.status in ('preparing', 'ready') then
    select
      count(*) filter (where not coalesce((item->>'cancelled')::boolean, false)),
      count(*) filter (where not coalesce((item->>'cancelled')::boolean, false)
        and (coalesce((item->>'done')::boolean, false) or item ? 'packaging' or coalesce((item->>'surcharge')::boolean, false)))
    into active_count, done_count
    from jsonb_array_elements(new.items) as item;

    if active_count > 0 and active_count = done_count then
      new.status := 'ready';
      new.ready_at := coalesce(new.ready_at, now());
    else
      new.status := 'preparing';
      new.ready_at := null;
    end if;
  end if;

  if new.status not in ('ready', 'handed_off') then
    new.out_for_delivery_at := null;
    new.driver_id := null;
  end if;

  new.handed_off := new.status = 'handed_off';
  return new;
end;
$function$;
