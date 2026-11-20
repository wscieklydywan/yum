-- Kiosk: self-service screen in the restaurant. Orders are dine-in ('Stacjonarnie') with source 'kiosk'.
alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source = any (array['yummy','own','glovo','pyszne','kiosk']));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['admin','szef','kuchnia','kelner','klient','kierowca','kiosk']));
