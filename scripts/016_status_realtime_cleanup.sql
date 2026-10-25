-- Restaurant status is pushed via the private Broadcast topic workshop:settings (see supabase/migrations/20261031_workshop_broadcast.sql).

-- Unused: the coupon preview is no longer called anywhere in the app.
drop function if exists public.workshop_coupon_preview(text);
