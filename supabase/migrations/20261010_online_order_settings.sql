-- Online ordering settings editable from the workshop: minimum order value,
-- distance-based delivery fee zones and packaging prices.
alter table public.restaurant_settings
  add column if not exists min_order_online numeric(8,2) not null default 40
    check (min_order_online between 0 and 1000),
  add column if not exists delivery_zones jsonb not null default '[{"upToKm":2,"fee":8},{"upToKm":4,"fee":10},{"upToKm":6,"fee":15},{"upToKm":10,"fee":20}]'::jsonb,
  add column if not exists packaging_prices jsonb not null default '{"burger":0.6,"box":0.7,"wrap":0.7,"foil":1,"bag":1}'::jsonb;
