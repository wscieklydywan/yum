-- Burger tygodnia: kadrowanie zdjęcia w kole. "contain" pokazuje całe zdjęcie bez docinania, "cover" wypełnia koło z wybranym punktem skupienia.

alter table public.home_slides_settings
  add column if not exists burger_week_image_fit text not null default 'contain'
    check (burger_week_image_fit in ('contain', 'cover')),
  add column if not exists burger_week_image_position text not null default 'center'
    check (burger_week_image_position in ('top', 'center', 'bottom'));
