-- Vegan burgers (RINGO, VEGASTIC) get the standard fries + drink set and only
-- plant-based upgrades: no extra meat, bacon or (non-vegan) cheese.
update public.menu_products v
   set extras = (
         select jsonb_agg(
                  case
                    when grp->>'group' = 'ULEPSZ SWOJEGO BURGERA' then
                      grp || jsonb_build_object('options', (
                        select coalesce(jsonb_agg(opt), '[]'::jsonb)
                          from jsonb_array_elements(grp->'options') opt
                         where opt->>'name' in ('Pomidor', 'Cebula', 'Pikle', 'Pieczarki')
                      ))
                    else grp
                  end)
           from jsonb_array_elements(b.extras) grp
       )
  from public.menu_products b
 where v.category_id = 'vege'
   and b.id = 'dae6fc20-a38c-11f1-8d3d-525400080621';
