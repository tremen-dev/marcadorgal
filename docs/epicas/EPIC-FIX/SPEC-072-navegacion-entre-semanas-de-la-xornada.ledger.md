---
id: SPEC-072
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-072 Navegación entre semanas de la xornada

## Resumen
- Fase: en-revision (ronda 2 tras RED V-1)
- Rama: `ft/SPEC-072-navegacion-entre-semanas-de-la-xornada`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/xornada/XornadaHeader.tsx` (fila `.title` con ‹ `<h1>` ›), `XornadaBody.tsx` (`arrows` al título solo si `hasRows && !showDayStrip`), `XornadaControls.tsx` (`WeekArrow` exportado) | `src/components/xornada/week-arrows.test.ts` «SPEC-072 CA-1 …» (5 casos: tira oculta con flechas / con huecos, tira visible sin duplicar, sin `arrows` ×2, defecto = producción) — `npx vitest run src/components/xornada/week-arrows.test.ts` → 9 passed | `npx vitest` (en `npm run test`): `week-arrows.test.ts` verde; 4 combinaciones + defecto revisadas, no vacías. Diff: `arrows` al título solo si `hasRows && !showDayStrip` → nunca duplicadas | ✅ |
| CA-2 | ídem + `Xornada.module.css` (`.heading`, `.title[data-arrows]`, `.title .weekArrow`; tokens, sin `font:`) | `week-arrows.test.ts` «SPEC-072 CA-2 …» gl/es (`href` sin `#`, `aria-label` i18n, glifo `aria-hidden`, fuera del `<h1>`, orden ‹ h1 ›) y hueco sin `tabindex` | Tests gl/es verdes (regex de `<a href>` + `aria-label` i18n + glifo `aria-hidden`, hueco sin `tabindex`). CSS: solo `var(--…)`, sin hex ni `font:`; foco `outline solid 2px` (e2e CA-5 en verde) | ✅ |
| CA-3 | `Xornada.module.css` (hairline de la fila como `box-shadow` inset: el `<h1>` conserva 42 px; escritorio `align-self: stretch`) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-3 at 360/390/1440px». Ronda 2 (V-1, `a1f5f79`): `main.y` se mide contra la barra de controles (padre de `filters`), no contra los filtros; en escritorio además cabecera 56 px y barra 44 px justo debajo. `npm run e2e:db` (Supabase local, Docker): CA-3 360/390/1440 gl y es ✅ (6/6). Medido en preview `2740a66` (`_qa/SPEC-072/recorrido.txt`): centros ‹/texto/› 73/73.5/73 (390) y 27.5/27.5/27.5 (1440); `main.y` 166 = prod 166 a 360 y 390; sin scroll ni truncado | `e2e:db` local (Docker): 360/390 gl/es ✅; **1440 gl/es ❌** `xornada-weeks-sen-tira.db.spec.ts:138` esperado 91, recibido 100 (`main.y` ≠ `filters` bottom en escritorio; `main.y`=100 también en prod: aserción mal planteada). Medidas móviles del ledger (166=166) coherentes | ❌ |
| CA-4 | `playwright.db.config.ts` (2º servidor `noStripPort` 3111, `SHOW_DAY_STRIP: ""`) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-4 without JS …» gl/es — PENDIENTE: `npm run e2e:db` (Supabase local/Docker; ver handoff). `npm run e2e` (sin base) → 299 passed, 1 skipped | `e2e:db` local: «CA-4 without JS» gl y es ✅ (puerto 3111 sin `SHOW_DAY_STRIP`); `xornada-weeks.db.spec.ts` (SPEC-027) completo ✅ | ✅ |
| CA-5 | — (orden del DOM: ‹ › en la cabecera antes de los filtros) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-5 keyboard …» gl/es — PENDIENTE con CA-4. En preview: Tab llega a ‹ con `outline solid 2px` (`recorrido.txt`) | `e2e:db` local: «CA-5 keyboard» gl y es ✅ (orden ‹ › filtros, foco visible, Enter navega) | ✅ |
| CA-6 | — | `docs/epicas/EPIC-FIX/_qa/SPEC-072/` 8 PNG (`portada-{gl,es}`, `semana-{gl,es}` × 390/1440, foco en ‹) + `recorrido.txt`: `/` ‹ → `/xornada/2026-10-31` («Xornada · 30 out – 2 nov») › → `/`; `/es` ‹ → `/es/xornada/2026-10-31` › → `/es` | 8 PNG revisados: ‹ › flanquean el título a 390/1440, foco en ‹ visible, sin truncado; `recorrido.txt` / → 2026-10-31 → / (gl y es). Estado del enlace por glifo + `aria-label`, no por color | ✅ |
| CA-7 | `package.json` 0.5.3 (ronda 2: merge de origin/main con SPEC-071 0.5.2, `npm version patch`) | `npm run gates`: typecheck, lint, build OK; test 2528 passed, 1 failed = `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (conocido en Windows, también en main). `npm run e2e` 299 passed. `git diff origin/main --stat -- src/board src/sources src/decide src/ingest supabase src/app/api src/app/config.ts` → vacío; `package.json` sin dependencias nuevas | typecheck ✅, lint ✅ (435 ficheros), test 2528 ✅ / 1 ❌ conocido (`test-db.test.ts` Windows), build ✅, `playwright test` 299 ✅ 1 skip. Frontera vacía; sin dependencias nuevas | ✅ |
| CA-8 | `docs/diseno/Movil.tpl.html`, `Escritorio.tpl.html`, `.dc.html` regenerados (`node build.mjs`), `HERENCIA.md` entrada 2026-11-10 | `npx vitest run src/design` → 183 passed; commit `2740a66` | Diff incluye `Movil/Escritorio.tpl.html`, `.dc.html`, `HERENCIA.md` 2026-11-10; `node build.mjs` no deja diff (regenerados al día) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-11-10 (sdd-verificador).** Producto correcto en lo observado; falla el test que demuestra CA-3.
- **V-1 (CA-3, bloqueante).** `npx playwright test --config playwright.db.config.ts` con Supabase local: `e2e/xornada-weeks-sen-tira.db.spec.ts:138` «CA-3 at 1440px» falla en gl y es (`expect(Math.round(main.y)).toBe(Math.round(filters.y + filters.height))` → esperado 91, recibido 100). En escritorio `filters` no ocupa la barra de controles de 44 px (56+44 = 100 = `main.y`, igual que prod en `recorrido.txt`): la aserción vale para móvil, no para escritorio. Corregir el test (p. ej. medir contra la barra de controles o `main.y` = 100) y volver a correr `e2e:db`.
- **V-2 (informativo, entorno).** En la misma corrida fallan 9 tests ajenos al diff: `xornada-realtime.db.spec.ts` ×7 (transporte `polling`: `spawnSync("supabase")` da ENOENT en Windows → `LOCAL_ANON_KEY` vacío) y `xornada-nav.db.spec.ts:103` «CA-4 with JS» gl/es (timeout en `competition-head` nth(1), servidor con tira, cabecera con mismas clases). No atribuidos a SPEC-072, no verificados contra main. El teardown `supabase db reset --local` también falla por ENOENT (no reseteó nada).
- **F-SPEC-072-1 aceptada.** CA-1 con tira solo exige «una sola vez»; el diseño y `HERENCIA.md` lo dibujan así. Sin flechas duplicadas en las 4 combinaciones (test) ni en demos.
- **Aviso de merge.** `package.json` 0.5.2 coincide con SPEC-071 (0.5.2): el segundo PR en entrar debe subir a 0.5.3.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-072/. Informe HTML opcional: _qa/SPEC-072/informe.html -->
| CA | Captura |
|---|---|
| CA-6 / CA-3 móvil | `_qa/SPEC-072/portada-gl-390.png`, `portada-es-390.png`, `semana-gl-390.png`, `semana-es-390.png` |
| CA-6 / CA-3 escritorio | `_qa/SPEC-072/portada-gl-1440.png`, `portada-es-1440.png`, `semana-gl-1440.png`, `semana-es-1440.png` |
| CA-4/CA-6 recorrido | `_qa/SPEC-072/recorrido.txt` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-072-1, F-SPEC-072-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-072-1 (interpretación de CA-1/CA-4).** Con `SHOW_DAY_STRIP` verdadero las ‹ › siguen en los extremos de la tira (SPEC-027 CA-6) y no en el título: es la única forma de cumplir «una sola vez» y a la vez mantener verde `e2e/xornada-weeks.db.spec.ts`, que exige las flechas dentro de `week-strip`. Sin la tira (producción) flanquean el título. `docs/diseno/` lo dibuja así (tira opcional sin flechas, nota en el comentario y en `HERENCIA.md`). Si el titular quiere las flechas siempre en el título, hay que cambiar ese e2e de SPEC-027. Destino: decisión del titular en el gate.
- **F-SPEC-072-2 (CA-6, entorno).** La captura no se hizo contra `next start` local: el `DATABASE_URL_PUBLIC` de `.env.local` viene redactado (`[SENSITIVE]`) de `vercel env pull`. Se hizo con Playwright local contra el preview de Vercel de `2740a66` (permitido por CA-6), con la cabecera OIDC de `vercel env run`. «Antes» = `https://marcador.gal` (main).
- **F-SPEC-072-3 (CA-3/CA-4/CA-5).** `e2e:db` no corre en CI ni en Windows sin Docker; el e2e nuevo queda escrito y sin ejecutar. Destino: verificador / titular (`npm run e2e:db` en Docker, ver memoria del entorno).

- **F-SPEC-072-4 (V-2, ajeno, ronda 2).** `e2e:db` en Windows: 49 passed, 9 failed, 1 skipped. Fallan `xornada-realtime.db.spec.ts` ×7 (polling: `spawnSync("supabase")` ENOENT en Windows → `LOCAL_ANON_KEY` vacío) y `xornada-nav.db.spec.ts:103` «CA-4 with JS» gl/es (timeout en `competition-head:visible` nth(1), l. 137). Este último falla **igual en origin/main** (`ee6dba2`, sin SPEC-072): `npx playwright test --config playwright.db.config.ts e2e/xornada-nav.db.spec.ts` → 2 failed (mismos dos, mismo locator), 14 passed. No es regresión de SPEC-072. Destino: EPIC-FIX/MEJORA (entorno Windows de `e2e:db`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Worktree `D:/src/tremen-dev/wt-072` (LF, `node_modules` real, `.vercel` copiado, sin `.env.local`), rama empujada, último commit `chore(version): 0.5.2 por SPEC-072`. Preview con el código: `https://marcadorgal-cmuo264a5-albertofojo-5908s-projects.vercel.app` (protegido; `vercel env run` + cabecera `x-vercel-trusted-oidc-idp-token`).
- Ronda 2 (2026-11-10): V-1 corregido en el test (`a1f5f79`); merge de origin/main (`af0b214`) y versión 0.5.3 (`2523c55`). `e2e:db` corrido con Supabase local: todo `xornada-weeks-sen-tira.db.spec.ts` (10/10) y `xornada-weeks.db.spec.ts` en verde; fallos restantes ajenos (F-SPEC-072-4). Gates tras el merge: typecheck ✅, lint ✅ (439 ficheros), test 2559 ✅ / 1 ❌ conocido (`test-db.test.ts`, Windows), `npm run build` ✅. Queda para el verificador: re-verificar CA-3 y decidir F-SPEC-072-1.
- (Ronda 1) Falta: correr `npm run e2e:db` (incluye el nuevo `e2e/xornada-weeks-sen-tira.db.spec.ts` en el puerto 3111 y los de SPEC-027/061) con Supabase local; decidir F-SPEC-072-1.
