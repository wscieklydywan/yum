-- Staff can switch off a payment method (e.g. broken card terminal). Card covers BLIK paid on the terminal.
alter table public.restaurant_settings add column if not exists cash_payment_enabled boolean not null default true;
alter table public.restaurant_settings add column if not exists card_payment_enabled boolean not null default true;
alter table public.restaurant_settings drop constraint if exists restaurant_settings_payment_method_any;
alter table public.restaurant_settings add constraint restaurant_settings_payment_method_any check (cash_payment_enabled or card_payment_enabled);
