insert into menu_product_variants (id, product_id, name, price, sort, active) values
  ('var_mozz_6', 'cc546aea-6bd0-11eb-bdef-525400080521', '6 szt', 15.99, 1, true),
  ('var_mozz_9', 'cc546aea-6bd0-11eb-bdef-525400080521', '9 szt', 17.99, 2, true)
on conflict (id) do update set name = excluded.name, price = excluded.price, sort = excluded.sort, active = excluded.active;

update menu_products set price = 15.99 where id = 'cc546aea-6bd0-11eb-bdef-525400080521';
