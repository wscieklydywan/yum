-- Treść strony „O nas” edytowana w Warsztat → Marketing → Strona „O nas”.
-- Jeden wiersz (id = 1); brak wiersza = domyślna treść z kodu (lib/about.ts).
create table if not exists public.about_page (
  id smallint primary key default 1 check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.about_page enable row level security;
-- Brak polityk: dostęp wyłącznie przez klucz serwisowy.
