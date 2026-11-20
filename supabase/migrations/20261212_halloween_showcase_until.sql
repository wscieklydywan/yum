-- Do kiedy slajd gry / zwycięzców jest widoczny na stronie głównej (ustawiane w warsztacie).

alter table public.halloween_settings
  add column if not exists showcase_until timestamptz not null default timestamptz '2026-12-01 00:00:00 Europe/Warsaw';

create or replace function public.halloween_public()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'active', now() >= s.starts_at and now() < s.ends_at,
    'ended', now() >= s.ends_at,
    'finalized', s.finalized_at is not null,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at,
    'showcase_until', s.showcase_until,
    'showcase', now() < s.showcase_until,
    'runner_up_stars', s.runner_up_stars,
    'prizes', (
      select coalesce(json_agg(json_build_object('place', (p->>'place')::int, 'title', p->>'title', 'short', p->>'short') order by (p->>'place')::int), '[]'::json)
      from jsonb_array_elements(s.prizes) p
    ),
    'winners', coalesce((
      select json_agg(json_build_object(
        'place', w.place,
        'name', private.halloween_display_name(pr.full_name),
        'score', w.score,
        'prize', w.prize
      ) order by w.place)
      from public.halloween_winners w join public.profiles pr on pr.id = w.user_id
      where w.place <= 3
    ), '[]'::json)
  )
  from public.halloween_settings s
  where s.id = 1;
$$;

revoke all on function public.halloween_public() from public;
grant execute on function public.halloween_public() to anon, authenticated, service_role;
