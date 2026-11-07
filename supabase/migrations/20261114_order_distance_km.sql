-- Distance from Yummy measured once when a delivery address is saved; the kitchen board only reads it.
alter table public.orders add column if not exists distance_km numeric(5,1);
