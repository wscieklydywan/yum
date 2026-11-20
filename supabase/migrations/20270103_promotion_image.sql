-- Optional graphic shown on the right side of the Yummy Club promotion tile.
alter table public.promotions add column if not exists image_url text;
