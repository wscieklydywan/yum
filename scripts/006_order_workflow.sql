-- Obieg zamówienia: KASA <-> KUCHNIA.
-- Każda pozycja w orders.items ma właściciela (station) i własny stan (done / cancelled / problem).
-- Status zamówienia liczy baza, nie człowiek:
--   new -> (kasa akceptuje) -> preparing -> (wszystkie aktywne pozycje done) -> ready -> (kasa wydaje) -> handed_off
--   new | preparing | ready -> (kasa anuluje) -> cancelled
-- Pozycje zostają w JSONB jednego wiersza: jedna tabela, jeden kanał realtime, jedna aktualizacja na kliknięcie.

-- 1. Stanowisko dania (napoje robi kasa, reszta kuchnia)
alter table public.menu_products
  add column if not exists station text not null default 'kitchen'
  check (station in ('kitchen', 'cashier'));

update public.menu_products set station = 'cashier' where category_id = 'napoje' and station <> 'cashier';

-- 2. Nowe statusy zamówienia
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.orders'::regclass and c.contype = 'c' and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check check (status in ('new', 'preparing', 'ready', 'handed_off', 'cancelled'));

alter table public.orders add column if not exists cancel_reason text;

-- Warsztat ładuje tylko aktywne zamówienia: mały indeks częściowy zamiast skanu całej historii.
create index if not exists orders_active_created_idx on public.orders (created_at)
  where status in ('new', 'preparing', 'ready');

-- 3. Normalizacja pozycji przy każdym INSERT (strona, warsztat, kupony, integracje)
create or replace function private.normalize_order_items(p_items jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    item
      || jsonb_build_object(
        'station', coalesce(item->>'station', (select m.station from public.menu_products m where m.name = item->>'name' limit 1), 'kitchen'),
        'done', coalesce((item->>'done')::boolean, false)
      )
    order by ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entries(item, ordinality);
$$;

-- 4. Status wyliczany z pozycji
create or replace function private.orders_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
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
      count(*) filter (where not coalesce((item->>'cancelled')::boolean, false) and coalesce((item->>'done')::boolean, false))
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

  new.handed_off := new.status = 'handed_off';
  return new;
end;
$$;

drop trigger if exists orders_workflow on public.orders;
create trigger orders_workflow
  before insert or update of items, status on public.orders
  for each row execute function private.orders_workflow();

-- 5. Jedno RPC na wszystkie akcje stanowisk (atomowy UPDATE jednego wiersza = brak wyścigów kasa/kuchnia)
create or replace function public.workshop_order_action(
  p_order_id uuid,
  p_action text,
  p_index int default null,
  p_value text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := coalesce((select private.user_role()), '');
  current_order public.orders%rowtype;
  item jsonb;
  item_station text;
begin
  if actor_role not in ('admin', 'kelner', 'kuchnia', 'kierowca') then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Zamówienie nie istnieje.' using errcode = 'P0002';
  end if;

  perform set_config('app.workshop_action', 'on', true);

  if p_index is not null then
    item := current_order.items -> p_index;
    if item is null then
      raise exception 'Pozycja nie istnieje.' using errcode = '22023';
    end if;
    item_station := coalesce(item->>'station', 'kitchen');
  end if;

  case p_action
    when 'accept' then
      if actor_role not in ('admin', 'kelner') or current_order.status <> 'new' then
        raise exception 'Nie można zaakceptować tego zamówienia.' using errcode = '42501';
      end if;
      update public.orders set status = 'preparing', started_at = now() where id = p_order_id;

    when 'toggle_item' then
      if current_order.status not in ('preparing', 'ready')
        or (item_station = 'kitchen' and actor_role not in ('admin', 'kuchnia'))
        or (item_station = 'cashier' and actor_role not in ('admin', 'kelner')) then
        raise exception 'Nie można zmienić tej pozycji.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem' || jsonb_build_object('done', p_value = 'true'))
      where id = p_order_id;

    when 'report_problem' then
      if current_order.status not in ('preparing', 'ready')
        or (item_station = 'kitchen' and actor_role not in ('admin', 'kuchnia'))
        or (item_station = 'cashier' and actor_role not in ('admin', 'kelner')) then
        raise exception 'Nie można zgłosić problemu.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) || jsonb_build_object('problem', left(coalesce(nullif(trim(p_value), ''), 'Problem'), 120), 'done', false))
      where id = p_order_id;

    when 'resolve_problem' then
      if actor_role not in ('admin', 'kelner') then
        raise exception 'Problem rozwiązuje kasa.' using errcode = '42501';
      end if;
      update public.orders set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem') where id = p_order_id;

    when 'cancel_item' then
      if actor_role not in ('admin', 'kelner') or current_order.status not in ('new', 'preparing', 'ready') then
        raise exception 'Pozycję anuluje kasa.' using errcode = '42501';
      end if;
      update public.orders
      set items = jsonb_set(items, array[p_index::text], (items -> p_index) - 'problem' || jsonb_build_object('cancelled', p_value <> 'false'))
      where id = p_order_id;

    when 'hand_off' then
      if actor_role not in ('admin', 'kelner', 'kierowca') or current_order.status <> 'ready' then
        raise exception 'Zamówienie nie jest gotowe do wydania.' using errcode = '42501';
      end if;
      update public.orders set status = 'handed_off', handed_off_at = now() where id = p_order_id;

    when 'cancel_order' then
      if actor_role not in ('admin', 'kelner') or current_order.status not in ('new', 'preparing', 'ready') then
        raise exception 'Zamówienie anuluje kasa.' using errcode = '42501';
      end if;
      update public.orders set status = 'cancelled', cancel_reason = left(nullif(trim(p_value), ''), 200) where id = p_order_id;

    else
      raise exception 'Nieznana akcja.' using errcode = '22023';
  end case;
end;
$$;

-- Kuchnia i kierowca zmieniają zamówienia wyłącznie przez RPC (uprawnienia per pozycja sprawdza workshop_order_action).
create or replace function private.enforce_order_role_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  actor_role text := (select private.user_role());
begin
  if current_setting('app.workshop_action', true) = 'on' then
    return new;
  end if;
  if actor_role in ('kuchnia', 'kierowca') then
    raise exception 'To stanowisko zmienia zamówienia tylko z poziomu warsztatu.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.workshop_order_action(uuid, text, int, text) from public, anon;
grant execute on function public.workshop_order_action(uuid, text, int, text) to authenticated;

-- 6. Uzupełnienie istniejących aktywnych zamówień
update public.orders
set items = (
  select jsonb_agg(entry || jsonb_build_object('done', orders.status = 'ready') order by ordinality)
  from jsonb_array_elements(private.normalize_order_items(orders.items)) with ordinality as entries(entry, ordinality)
)
where status in ('new', 'preparing', 'ready') and jsonb_array_length(items) > 0;

update public.orders set status = 'handed_off' where handed_off and status <> 'handed_off';
