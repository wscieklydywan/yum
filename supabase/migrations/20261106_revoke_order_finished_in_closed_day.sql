-- Helper is only called from SECURITY DEFINER triggers (enforce_order_handoff_rules,
-- enforce_refund_day_lock), which run as the owner, so no API role needs EXECUTE.
revoke execute on function public.order_finished_in_closed_day(timestamptz) from public, anon, authenticated;
