-- Orders placed from the installed PWA get their own source, so the bar and reports can tell them apart from the website.
alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source = any (array['yummy','app','own','glovo','pyszne','kiosk']));

-- Wheel prizes can show the plain number of points instead of an icon or a photo.
alter table public.wheel_prizes drop constraint if exists wheel_prizes_visual_check;
alter table public.wheel_prizes add constraint wheel_prizes_visual_check check (visual = any (array['image','icon','points']));
