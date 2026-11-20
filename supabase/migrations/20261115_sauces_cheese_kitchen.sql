-- Sosy do nuggetsów i boxów oraz serki mozzarella przygotowuje kuchnia, nie bar.
update menu_modifier_groups set station = 'kitchen' where id in ('sosy_nuggetsy', 'sosy_box');
update menu_modifier_options set stations = array['kitchen'] where group_id in ('sosy_nuggetsy', 'sosy_box');
update menu_products set station = 'kitchen' where id = 'cc546aea-6bd0-11eb-bdef-525400080521';
