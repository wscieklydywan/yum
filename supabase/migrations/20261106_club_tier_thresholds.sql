-- Yummy Club tiers editable in Warsztat → Yummy Club → Poziomy i rabaty.
-- Tier progress counts only profiles.status_points (Stars earned from orders).

alter table public.restaurant_settings
  add column if not exists silver_fan_threshold_points integer not null default 1000,
  add column if not exists gold_fan_threshold_points integer not null default 3000,
  add column if not exists silver_fan_discount_percent numeric(5,2) not null default 5,
  add column if not exists gold_fan_discount_percent numeric(5,2) not null default 10,
  add column if not exists fan_perks text not null default '',
  add column if not exists silver_fan_perks text not null default '',
  add column if not exists gold_fan_perks text not null default '';

update public.restaurant_settings
set silver_fan_threshold_points = 1000,
    gold_fan_threshold_points = 3000,
    silver_fan_discount_percent = 5,
    gold_fan_discount_percent = 10
where id = 1;

create or replace function private.club_tier_percent(p_status_points integer)
returns numeric
language sql
stable
set search_path to ''
as $function$
  select coalesce((
    select case
      when p_status_points >= s.gold_fan_threshold_points then s.gold_fan_discount_percent
      when p_status_points >= s.silver_fan_threshold_points then s.silver_fan_discount_percent
      else 0
    end
    from public.restaurant_settings s
    where s.id = 1
  ), 0)::numeric;
$function$;
