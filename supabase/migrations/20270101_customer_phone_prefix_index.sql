-- Prefix search of club customers by phone (workshop customer list + bar order suggestions).
-- profiles_phone_key uses the default collation, so it cannot serve `phone like '600%'`.
-- text_pattern_ops makes the LIKE prefix an index range scan; the partial predicate keeps
-- the index limited to customers who actually have a phone.
create index if not exists profiles_klient_phone_prefix_idx
  on public.profiles (phone text_pattern_ops)
  where role = 'klient' and phone is not null;
