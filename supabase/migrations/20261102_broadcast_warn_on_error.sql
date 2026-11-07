-- Same behaviour as 20261031 (a Realtime failure never blocks saving an order), but the failure is now visible
-- in Supabase Postgres logs instead of being swallowed silently.

create or replace function private.broadcast_workshop_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed jsonb;
  changed jsonb;
begin
  begin
    if tg_op = 'DELETE' then
      removed := jsonb_build_object('event', 'DELETE', 'id', old.id);
      perform realtime.send(removed, 'order', 'workshop:orders', true);
      if old.type = 'Dostawa' then
        perform realtime.send(removed, 'order', 'workshop:delivery', true);
      end if;
      return null;
    end if;

    changed := jsonb_build_object('event', tg_op, 'record', private.workshop_order_row(new));
    perform realtime.send(changed, 'order', 'workshop:orders', true);

    if new.type = 'Dostawa' then
      perform realtime.send(changed, 'order', 'workshop:delivery', true);
    elsif tg_op = 'UPDATE' and old.type = 'Dostawa' then
      perform realtime.send(jsonb_build_object('event', 'DELETE', 'id', new.id), 'order', 'workshop:delivery', true);
    end if;
  exception when others then
    raise warning 'workshop broadcast failed for order %: % (%)', coalesce(new.id, old.id), sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create or replace function private.broadcast_workshop_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name), 'refresh', tg_argv[0], true);
  exception when others then
    raise warning 'workshop refresh broadcast failed for %: % (%)', tg_table_name, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

revoke all on function private.broadcast_workshop_order() from public, anon, authenticated;
revoke all on function private.broadcast_workshop_refresh() from public, anon, authenticated;
