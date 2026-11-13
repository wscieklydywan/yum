-- Promocja online może być ograniczona do zamówień z odbiorem osobistym (bez dostawy).
alter table public.promotions
  add column if not exists online_pickup_only boolean not null default false;

-- "Drugi burger za 10 zł": na miejscu + online tylko przy odbiorze osobistym.
update public.promotions
set online = true, in_store = true, online_pickup_only = true, updated_at = now()
where id = 'b53953d6-1822-4ae9-9edb-27d50e450d7a';
