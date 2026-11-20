-- Junior set: small fries + small drink for +5.01 zł (17.99 + 5.01 = 23.00 zł).
insert into menu_modifier_groups (id, name, selection_mode, min_selections, max_selections, sort, active, station)
values ('zestaw_junior', 'Małe frytki + mały napój', 'single', 0, 1, 9, true, 'cashier')
on conflict (id) do update set name = excluded.name, active = true;

insert into menu_modifier_options (id, group_id, name, price_delta, sort, active, stations) values
  ('combojr_pepsi', 'zestaw_junior', 'Mała Pepsi + małe frytki', 0, 1, true, array['cashier', 'kitchen']),
  ('combojr_pepsi_max', 'zestaw_junior', 'Mała Pepsi Max + małe frytki', 0, 2, true, array['cashier', 'kitchen']),
  ('combojr_mirinda', 'zestaw_junior', 'Mała Mirinda + małe frytki', 0, 3, true, array['cashier', 'kitchen']),
  ('combojr_7up', 'zestaw_junior', 'Mały 7UP + małe frytki', 0, 4, true, array['cashier', 'kitchen']),
  ('combojr_woda', 'zestaw_junior', 'Mała woda niegazowana + małe frytki', 0, 5, true, array['cashier', 'kitchen'])
on conflict (id) do update set name = excluded.name, active = true;

delete from menu_product_modifier_groups where group_id = 'zestaw_junior';
insert into menu_product_modifier_groups (product_id, group_id, required, min_selections, max_selections, price_delta_override, sort)
select id, 'zestaw_junior', false, null, null, 5.01, 1
from menu_products
where id in ('chicko-junior-86ebc5', 'o-yummy-junior-8fdee0', 'yummy-junior-2b8dd8', 'bacon-junior-4c246e');
