-- Restaurant status (open/closed, hours) is pushed to clients via Realtime instead of 30s polling.
alter publication supabase_realtime add table public.restaurant_settings;

-- Unused: the coupon preview is no longer called anywhere in the app.
drop function if exists public.workshop_coupon_preview(text);
