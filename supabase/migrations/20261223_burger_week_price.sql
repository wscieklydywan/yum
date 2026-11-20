-- Burger tygodnia może mieć własną cenę (puste = cena z menu). Obowiązuje w całym sklepie, dopóki slajd jest aktywny.
alter table public.home_slides_settings
  add column if not exists burger_week_price numeric(10, 2) check (burger_week_price is null or (burger_week_price >= 0 and burger_week_price <= 999));
