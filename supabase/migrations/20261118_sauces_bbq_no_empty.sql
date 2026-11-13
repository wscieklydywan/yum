-- One name for the BBQ sauce everywhere (product "BBQ" and every sauce add-on).
update public.menu_modifier_options set name = 'BBQ' where name = 'Barbeque';

-- "Bez sosu" is redundant: leaving sauces unselected means no sauce.
update public.menu_modifier_options set active = false where name = 'Bez sosu';
update public.menu_modifier_groups set min_selections = 0 where id = 'sosy_box';
