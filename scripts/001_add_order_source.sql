alter table public.orders
  add column if not exists source text not null default 'yummy'
  check (source in ('yummy', 'own', 'glovo', 'pyszne'));

update public.orders set source = 'glovo', note = nullif(trim(substr(note, length('[Glovo]') + 1)), '')
  where source = 'yummy' and note like '[Glovo]%';
update public.orders set source = 'pyszne', note = nullif(trim(substr(note, length('[Pyszne.pl]') + 1)), '')
  where source = 'yummy' and note like '[Pyszne.pl]%';
update public.orders set source = 'own', note = nullif(trim(substr(note, length('[Własne]') + 1)), '')
  where source = 'yummy' and note like '[Własne]%';
