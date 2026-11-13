-- Optional free-delivery threshold (value of products). NULL means delivery is never free.
alter table public.restaurant_settings
  add column if not exists free_delivery_from numeric(8,2)
    check (free_delivery_from is null or free_delivery_from between 0 and 1000);
