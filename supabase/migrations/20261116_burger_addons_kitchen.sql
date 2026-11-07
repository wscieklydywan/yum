-- Dodatki do burgera przygotowuje kuchnia razem z burgerem.
update menu_modifier_groups set station = 'kitchen' where id = 'dodatki_burger';
update menu_modifier_options set stations = array['kitchen'] where group_id = 'dodatki_burger';
