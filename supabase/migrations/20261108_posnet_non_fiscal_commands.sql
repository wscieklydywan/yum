alter table public.posnet_non_fiscal_settings
  add column if not exists commands jsonb;

update public.posnet_non_fiscal_settings
set settings = jsonb_set(settings, '{qrTemplate}', to_jsonb('https://www.yummyrybnik.pl/yummy-club/instaluj?utm_source=qr&utm_campaign=paragon'::text))
where id = 1 and coalesce(settings->>'qrTemplate', '') = '';

update public.posnet_non_fiscal_settings s
set commands = (
  select jsonb_agg(c order by ord)
  from (
    select 1 as ord, '{"type":"line","text":"+--------------------------------------+"}'::jsonb as c
    union all select 2, '{"type":"line","text":"|       ZAMÓWIENIE {orderNumber}       |"}'::jsonb
    union all select 3, '{"type":"line","text":"+--------------------------------------+"}'::jsonb
    union all select 4, '{"type":"free_items"}'::jsonb
    union all select 5 + l.n, jsonb_build_object('type', 'line', 'text', l.line)
      from jsonb_array_elements_text(s.settings->'lines') with ordinality as l(line, n)
    union all select 100, '{"type":"qr_caption","text":"ZESKANUJ KOD QR"}'::jsonb
      where coalesce(s.settings->>'qrTemplate', '') <> ''
    union all select 101, jsonb_build_object('type', 'qr', 'data', s.settings->>'qrTemplate', 'errorCorrection', 'M')
      where coalesce(s.settings->>'qrTemplate', '') <> ''
  ) commands
)
where id = 1 and commands is null;
