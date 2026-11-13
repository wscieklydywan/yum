-- Prints "www.yummyrybnik.pl" right below the QR code. The APK prints `commands` as-is, so no APK change is needed.
-- Idempotent: only inserts when the line is not already directly after the QR command.
update public.posnet_non_fiscal_settings s
set commands = (
  select jsonb_agg(item order by ord, sub)
  from (
    select c.item, c.ord, 0 as sub from jsonb_array_elements(s.commands) with ordinality as c(item, ord)
    union all
    select jsonb_build_object(
      'type', 'line', 'text', 'www.yummyrybnik.pl', 'align', 'center', 'size', 'normal', 'bold', true,
      'posnet', '&c&swww.yummyrybnik.pl&s&c'
    ), c.ord, 1
    from jsonb_array_elements(s.commands) with ordinality as c(item, ord)
    where c.item->>'type' = 'qr'
  ) parts
),
updated_at = now()
where s.id = 1
  and s.commands is not null
  and exists (select 1 from jsonb_array_elements(s.commands) e where e->>'type' = 'qr')
  and not exists (select 1 from jsonb_array_elements(s.commands) e where e->>'text' = 'www.yummyrybnik.pl');
