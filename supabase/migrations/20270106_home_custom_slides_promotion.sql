-- Własne slajdy: podpięcie pod promocję. Slajd z promocją pokazuje się tylko wtedy, gdy promocja trwa.

alter table public.home_custom_slides
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null;
