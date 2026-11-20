-- Zapamiętany adres dostawy klienta Yummy Club (edytowany w profilu, widoczny dla obsługi na barze).
alter table public.profiles add column if not exists address text;
alter table public.profiles drop constraint if exists profiles_address_length;
alter table public.profiles add constraint profiles_address_length check (address is null or char_length(address) <= 160);
