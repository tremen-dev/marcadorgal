---
id: SPEC-072
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-072 Navegación entre semanas de la xornada

## Resumen
- Fase: en-revision
- Rama: `ft/SPEC-072-navegacion-entre-semanas-de-la-xornada`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/xornada/XornadaHeader.tsx` (fila `.title` con ‹ `<h1>` ›), `XornadaBody.tsx` (`arrows` al título solo si `hasRows && !showDayStrip`), `XornadaControls.tsx` (`WeekArrow` exportado) | `src/components/xornada/week-arrows.test.ts` «SPEC-072 CA-1 …» (5 casos: tira oculta con flechas / con huecos, tira visible sin duplicar, sin `arrows` ×2, defecto = producción) — `npx vitest run src/components/xornada/week-arrows.test.ts` → 9 passed | | ❌ |
| CA-2 | ídem + `Xornada.module.css` (`.heading`, `.title[data-arrows]`, `.title .weekArrow`; tokens, sin `font:`) | `week-arrows.test.ts` «SPEC-072 CA-2 …» gl/es (`href` sin `#`, `aria-label` i18n, glifo `aria-hidden`, fuera del `<h1>`, orden ‹ h1 ›) y hueco sin `tabindex` | | ❌ |
| CA-3 | `Xornada.module.css` (hairline de la fila como `box-shadow` inset: el `<h1>` conserva 42 px; escritorio `align-self: stretch`) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-3 at 360/390/1440px» (pendiente de correr: requiere Supabase local). Medido en preview `2740a66` (`_qa/SPEC-072/recorrido.txt`): centros ‹/texto/› 73/73.5/73 (390) y 27.5/27.5/27.5 (1440); `main.y` 166 = prod 166 a 360 y 390; sin scroll ni truncado | | ❌ |
| CA-4 | `playwright.db.config.ts` (2º servidor `noStripPort` 3111, `SHOW_DAY_STRIP: ""`) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-4 without JS …» gl/es — PENDIENTE: `npm run e2e:db` (Supabase local/Docker; ver handoff). `npm run e2e` (sin base) → 299 passed, 1 skipped | | ❌ |
| CA-5 | — (orden del DOM: ‹ › en la cabecera antes de los filtros) | `e2e/xornada-weeks-sen-tira.db.spec.ts` «CA-5 keyboard …» gl/es — PENDIENTE con CA-4. En preview: Tab llega a ‹ con `outline solid 2px` (`recorrido.txt`) | | ❌ |
| CA-6 | — | `docs/epicas/EPIC-FIX/_qa/SPEC-072/` 8 PNG (`portada-{gl,es}`, `semana-{gl,es}` × 390/1440, foco en ‹) + `recorrido.txt`: `/` ‹ → `/xornada/2026-10-31` («Xornada · 30 out – 2 nov») › → `/`; `/es` ‹ → `/es/xornada/2026-10-31` › → `/es` | | ❌ |
| CA-7 | `package.json` 0.5.2 | `npm run gates`: typecheck, lint, build OK; test 2528 passed, 1 failed = `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (conocido en Windows, también en main). `npm run e2e` 299 passed. `git diff origin/main --stat -- src/board src/sources src/decide src/ingest supabase src/app/api src/app/config.ts` → vacío; `package.json` sin dependencias nuevas | | ❌ |
| CA-8 | `docs/diseno/Movil.tpl.html`, `Escritorio.tpl.html`, `.dc.html` regenerados (`node build.mjs`), `HERENCIA.md` entrada 2026-11-10 | `npx vitest run src/design` → 183 passed; commit `2740a66` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-072/. Informe HTML opcional: _qa/SPEC-072/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-072-1, F-SPEC-072-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-072-1 (interpretación de CA-1/CA-4).** Con `SHOW_DAY_STRIP` verdadero las ‹ › siguen en los extremos de la tira (SPEC-027 CA-6) y no en el título: es la única forma de cumplir «una sola vez» y a la vez mantener verde `e2e/xornada-weeks.db.spec.ts`, que exige las flechas dentro de `week-strip`. Sin la tira (producción) flanquean el título. `docs/diseno/` lo dibuja así (tira opcional sin flechas, nota en el comentario y en `HERENCIA.md`). Si el titular quiere las flechas siempre en el título, hay que cambiar ese e2e de SPEC-027. Destino: decisión del titular en el gate.
- **F-SPEC-072-2 (CA-6, entorno).** La captura no se hizo contra `next start` local: el `DATABASE_URL_PUBLIC` de `.env.local` viene redactado (`[SENSITIVE]`) de `vercel env pull`. Se hizo con Playwright local contra el preview de Vercel de `2740a66` (permitido por CA-6), con la cabecera OIDC de `vercel env run`. «Antes» = `https://marcador.gal` (main).
- **F-SPEC-072-3 (CA-3/CA-4/CA-5).** `e2e:db` no corre en CI ni en Windows sin Docker; el e2e nuevo queda escrito y sin ejecutar. Destino: verificador / titular (`npm run e2e:db` en Docker, ver memoria del entorno).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Worktree `D:/src/tremen-dev/wt-072` (LF, `node_modules` real, `.vercel` copiado, sin `.env.local`), rama empujada, último commit `chore(version): 0.5.2 por SPEC-072`. Preview con el código: `https://marcadorgal-cmuo264a5-albertofojo-5908s-projects.vercel.app` (protegido; `vercel env run` + cabecera `x-vercel-trusted-oidc-idp-token`).
- Falta: correr `npm run e2e:db` (incluye el nuevo `e2e/xornada-weeks-sen-tira.db.spec.ts` en el puerto 3111 y los de SPEC-027/061) con Supabase local; decidir F-SPEC-072-1.
