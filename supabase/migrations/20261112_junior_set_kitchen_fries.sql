-- Junior set options must keep the "drink + fries" form: each part becomes its own order line on its own station
-- (drink → cashier, fries → kitchen). Without the "+" the whole set was one cashier line and fries never reached
-- the kitchen. The receipt line is only the paid drink part, e.g. "Mała Pepsi Max (zestaw)", well under 40 chars.
update menu_modifier_options set name = 'Mała Pepsi + małe frytki', stations = array['cashier', 'kitchen'] where id = 'combojr_pepsi';
update menu_modifier_options set name = 'Mała Pepsi Max + małe frytki', stations = array['cashier', 'kitchen'] where id = 'combojr_pepsi_max';
update menu_modifier_options set name = 'Mała Mirinda + małe frytki', stations = array['cashier', 'kitchen'] where id = 'combojr_mirinda';
update menu_modifier_options set name = 'Mały 7UP + małe frytki', stations = array['cashier', 'kitchen'] where id = 'combojr_7up';
update menu_modifier_options set name = 'Mała woda + małe frytki', stations = array['cashier', 'kitchen'] where id = 'combojr_woda';
