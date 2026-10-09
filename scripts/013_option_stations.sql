-- Stanowisko realizacji ustawiane w edytorze menu przy każdej opcji dodatku.
-- Jedna wartość na każdą część opcji: "Sos czosnkowy" -> {cashier}, "Pepsi + frytki" -> {cashier,kitchen}.
-- Brak wartości = stanowisko grupy.

alter table public.menu_modifier_options add column if not exists stations text[];

alter table public.menu_modifier_options drop constraint if exists menu_modifier_options_stations_check;
alter table public.menu_modifier_options
  add constraint menu_modifier_options_stations_check
  check (stations is null or stations <@ array['kitchen', 'cashier']::text[]);
