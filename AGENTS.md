<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Skalowanie UI na desktopie / tablecie (WAŻNE przed powiększaniem czegokolwiek)

Panel warsztatu (kuchnia/bar) jest sprawdzany na Galaxy Tab S11 Ultra (14.6"). Sekcje ustawień (`.workshop-settings`) i wszystkie modale są powiększane globalnie przez CSS `zoom` ze zmienną `--ui-zoom` w `app/globals.css`:

| Szerokość ekranu | `--ui-zoom` |
| --- | --- |
| >= 1024px | 1.05 |
| >= 1180px | 1.15 |
| >= 1536px | 1.25 |

Zasady:

- Nie dodawaj dodatkowych klas `lg:`/`xl:` powiększających tekst/przyciski wewnątrz obszarów objętych zoomem — sumują się z zoomem. Skalę zmieniaj w `globals.css`.
- Modal można wyłączyć z zoomu atrybutem `data-keep-size` na `DialogContent` (używają go modal dodawania zamówienia i modal produktu po stronie klienta — są dopracowane ręcznie).
- `zoom` mnoży też jednostki `vh`/`dvh` — w obszarach z zoomem dziel przez zoom: `max-h-[calc(90dvh/var(--ui-zoom,1))]`.
- Elementy poza zoomem (np. przyciski „Kupon” i „Dodaj zamówienie” w nagłówku, `components/warsztat/workshop-order-actions.tsx`) powiększamy bezpośrednio klasami `lg:`.
- Kuchnia pokazuje tylko to, co kuchnia robi — kody rabatowe/kupony i inne dane od klienta są tylko na barze (filtr notatki w `workshop-kitchen-board.tsx`).
