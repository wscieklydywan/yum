-- Kolor kafelka w kalendarzu adwentowym (czerwony / zielony / złoty). NULL = kolor domyślny.
alter table public.advent_days
  add column if not exists color text check (color in ('red', 'green', 'gold'));

create or replace function public.advent_calendar()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
  uid uuid := auth.uid();
  today integer;
begin
  select * into s from public.advent_settings where id = 1;
  if not found then
    return json_build_object('mode', 'off');
  end if;
  today := private.advent_today(s.starts_on);

  return json_build_object(
    'mode', s.mode,
    'starts_on', s.starts_on,
    'days', s.days,
    'today', today,
    'started', s.mode = 'live' and today >= 1,
    'ended', s.mode = 'live' and today > s.days,
    'allow_late', s.allow_late,
    'teaser_text', s.teaser_text,
    'show_home_slide', s.show_home_slide,
    'show_bubble', s.show_bubble,
    'show_club_banner', s.show_club_banner,
    'logged_in', uid is not null,
    'windows', (
      select coalesce(json_agg(json_build_object(
        'day', d.day,
        'color', d.color,
        'openable', s.mode = 'live' and c.day is null and d.day <= today and today <= s.days
          and (d.day = today or s.allow_late),
        'missed', s.mode = 'live' and c.day is null and d.day < today and not s.allow_late,
        'claimed', c.day is not null,
        'title', c.title,
        'kind', c.kind,
        'stars', c.stars,
        'code', c.code
      ) order by d.day), '[]'::json)
      from public.advent_days d
      left join public.advent_claims c on c.day = d.day and c.user_id = uid
      where d.day <= s.days
    )
  );
end;
$$;

revoke all on function public.advent_calendar() from public;
grant execute on function public.advent_calendar() to anon, authenticated, service_role;
