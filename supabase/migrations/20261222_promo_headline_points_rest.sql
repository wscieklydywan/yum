-- 1) Duże hasło promocji na stronie głównej (np. "Frytki dorzucamy GRATIS!"). Puste = automatyczny dopisek rabatu.
alter table public.promotions add column if not exists headline text not null default '';
alter table public.promotions drop constraint if exists promotions_headline_check;
alter table public.promotions add constraint promotions_headline_check check (char_length(headline) <= 60);

update public.promotions
set title = 'KOLEJNE ZAMÓWIENIE?',
    headline = 'Frytki dorzucamy GRATIS!',
    description = 'Zamów ponownie przez naszą stronę i zgarnij porcję cienkich frytek na nasz koszt. Dodaj je do koszyka, a rabat naliczy się automatycznie.'
where id = '35c6a696-138e-4d6d-8142-0cb7759b9a99';

-- 2) Płacenie Stars: czy kwota, która zostaje do zapłaty po obniżce Stars, nalicza nowe Stars.
alter table public.restaurant_settings
  add column if not exists points_payment_earns_rest boolean not null default true;

-- Zapamiętane na zamówieniu w chwili złożenia, żeby zmiana ustawienia nie zmieniała starych zamówień.
alter table public.orders
  add column if not exists points_earn_rest boolean not null default true;

create or replace function private.orders_loyalty()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  old_base numeric := 0;
  new_base numeric := 0;
  earned integer;
begin
  if tg_op = 'UPDATE' then
    if old.loyalty_points is not null and old.loyalty_base is null then
      return new;
    end if;
    old_base := coalesce(old.loyalty_base, 0);
    if old.customer_id is distinct from new.customer_id and old_base > 0 then
      perform private.loyalty_apply(old.customer_id, -old_base, 'Korekta zamówienia #' || old.number);
      old_base := 0;
      new.loyalty_points := 0;
    end if;
  end if;

  if new.status = 'handed_off' and new.customer_id is not null
     and not (coalesce(new.points_used, 0) > 0 and not coalesce(new.points_earn_rest, true))
     and exists (select 1 from public.profiles where id = new.customer_id and role = 'klient') then
    new_base := private.loyalty_base(new.items, new.discount);
  end if;

  if new_base = old_base then
    return new;
  end if;

  earned := private.loyalty_apply(
    new.customer_id,
    new_base - old_base,
    case when new_base > old_base then 'Zamówienie #' || new.number else 'Zwrot / korekta zamówienia #' || new.number end
  );
  new.loyalty_base := new_base;
  new.loyalty_points := coalesce(new.loyalty_points, 0) + earned;
  return new;
end;
$function$;
