alter table public.home_slides_settings add column if not exists club_hidden_slides text[] not null default array[]::text[];
