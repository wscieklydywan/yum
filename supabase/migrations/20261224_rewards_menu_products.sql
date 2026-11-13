-- Kupony „Wydaj Stars” powiązane z prawdziwymi produktami z menu.
-- loyalty_rewards.items: [{ "product_id": text, "name": text, "quantity": int, "choice": bool }]
-- choice = klient może wybrać inny produkt z tej samej kategorii w tej samej lub niższej cenie.
-- Przy odbiorze kuponu pozycje są budowane na żywo z menu_products (aktualna nazwa, stanowisko),
-- a wartość nagrody liczona z aktualnych cen menu. Stare pozycje bez product_id działają jak dotąd.

create or replace function public.redeem_reward(reward_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  reward public.loyalty_rewards%rowtype;
  food_cost numeric;
  current_points integer;
  new_points integer;
  new_code text;
  new_id bigint;
  new_expires timestamptz := now() + interval '24 hours';
  entry jsonb;
  product record;
  qty integer;
  resolved jsonb := '[]'::jsonb;
  live_value numeric := 0;
  linked boolean := false;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into reward from public.loyalty_rewards where key = reward_key and active;
  if not found then
    raise exception 'unknown_reward' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(reward.items) loop
    qty := greatest(1, least(10, coalesce((entry->>'quantity')::integer, 1)));
    if coalesce(entry->>'product_id', '') = '' then
      resolved := resolved || jsonb_build_array(entry);
      continue;
    end if;
    linked := true;
    select p.name, p.price, coalesce(nullif(p.station, ''), 'kitchen') as station, c.label as category
      into product
      from public.menu_products p
      left join public.menu_categories c on c.id = p.category_id
      where p.id = entry->>'product_id' and p.available
        and (p.available_until is null or p.available_until > now());
    if not found then
      raise exception 'unknown_reward' using errcode = '22023';
    end if;
    live_value := live_value + product.price * qty;
    resolved := resolved || jsonb_build_array(jsonb_build_object(
      'name', product.name,
      'quantity', qty,
      'station', product.station,
      'options', case when coalesce((entry->>'choice')::boolean, false)
        then format('Kupon · lub inny z: %s do %s zł', coalesce(product.category, 'tej kategorii'), replace(to_char(product.price, 'FM9990.00'), '.', ','))
        else 'Kupon Yummy Club' end
    ));
  end loop;

  select points into current_points from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;
  if current_points < reward.cost then
    raise exception 'not_enough_points' using errcode = 'P0001';
  end if;

  delete from public.reward_redemptions where expires_at <= now();

  loop
    new_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.reward_redemptions where code = new_code);
  end loop;

  update public.profiles set points = points - reward.cost where id = uid returning points into new_points;

  insert into public.reward_redemptions (user_id, reward, cost, code, items, expires_at)
  values (uid, reward.name, reward.cost, new_code, resolved, new_expires)
  returning id into new_id;
  insert into public.point_transactions (user_id, amount, kind, note)
  values (uid, -reward.cost, 'redeem', reward.name);

  select coalesce(food_cost_percent, 30) into food_cost from public.restaurant_settings where id = 1;
  insert into public.marketing_events (source, ref_id, label, amount, user_id)
  values ('reward', reward.key, reward.name,
    round((case when linked then live_value else reward.menu_value end) * coalesce(food_cost, 30) / 100, 2), uid);

  return json_build_object(
    'id', new_id,
    'code', new_code, 'points', new_points, 'reward', reward.name, 'cost', reward.cost,
    'items', resolved, 'expires_at', new_expires
  );
end;
$$;
revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;
update public.loyalty_rewards r set items = v.items::jsonb, updated_at = now()
from (values
  ('sauce', '[{"product_id":"49015a35-6132-11ed-8bca-525400080621","name":"KETCHUP","quantity":1,"choice":true}]'),
  ('drink', '[{"product_id":"ecd9ece3-6bd0-11eb-bdef-525400080521","name":"PEPSI","quantity":1,"choice":true}]'),
  ('fries', '[{"product_id":"7fb4c9e9-6bd0-11eb-bdef-525400080521","name":"FRYTKI CIENKIE","quantity":1}]'),
  ('rings', '[{"product_id":"aa6195d2-6bd0-11eb-bdef-525400080521","name":"KRĄŻKI CEBULOWE","quantity":1}]'),
  ('nuggets', '[{"product_id":"70297c89-6bd0-11eb-bdef-525400080521","name":"NUGGETSY","quantity":1}]'),
  ('burger', '[{"product_id":"8f9d3589-6bcf-11eb-bdef-525400080521","name":"SERTASTIC","quantity":1}]'),
  ('combo', '[{"product_id":"8f9d3589-6bcf-11eb-bdef-525400080521","name":"SERTASTIC","quantity":1},{"product_id":"7fb4c9e9-6bd0-11eb-bdef-525400080521","name":"FRYTKI CIENKIE","quantity":1},{"product_id":"ecd9ece3-6bd0-11eb-bdef-525400080521","name":"PEPSI","quantity":1,"choice":true}]')
) as v(key, items)
where r.key = v.key;
