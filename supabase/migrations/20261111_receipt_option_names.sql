-- POSNET receipt lines are "Produkt (opcja)" and must fit 40 characters; otherwise the receipt drops the option
-- and shows only the bare product name at the full set price. Paid option names are shortened so every
-- product + option combination fits.
update menu_modifier_options set name = 'Mały zestaw Pepsi' where id = 'combojr_pepsi';
update menu_modifier_options set name = 'Mały zestaw Pepsi Max' where id = 'combojr_pepsi_max';
update menu_modifier_options set name = 'Mały zestaw Mirinda' where id = 'combojr_mirinda';
update menu_modifier_options set name = 'Mały zestaw 7UP' where id = 'combojr_7up';
update menu_modifier_options set name = 'Mały zestaw woda' where id = 'combojr_woda';

update menu_modifier_options set name = 'Pepsi Max+frytki' where id in ('combo10_pepsi_max', 'combo11_pepsi_max');
update menu_modifier_options set name = 'Woda + frytki' where id in ('combo10_woda', 'combo11_woda');

update menu_modifier_options set name = 'Woda gazowana' where group_id = 'napoj' and name = 'Woda mineralna gazowana';
update menu_modifier_options set name = 'Woda niegazowana' where group_id = 'napoj' and name = 'Woda mineralna niegazowana';

update menu_modifier_options set name = 'Miód-musztarda' where group_id = 'sosy' and name = 'Miodowo-musztardowy';
