-- Pinned menu items are shown first in the public menu (e.g. the VICE set during the GTA VI campaign).
alter table public.menu_products add column if not exists pinned boolean not null default false;
update public.menu_products set pinned = true where id = 'vice-zestaw-ce50db';
