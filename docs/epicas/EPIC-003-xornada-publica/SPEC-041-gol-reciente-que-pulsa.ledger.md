---
id: SPEC-041
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-041 Gol reciente que pulsa

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-041-gol-reciente-que-pulsa` (sale de la rama de SPEC-040, PR #83)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20261101120000_spec041_scored_at.sql` | `src/db/web.db.test.ts` «SPEC-041 CA-1 …» (14 casos de tabla + sin Decision + web_reader) y lista de columnas de SPEC-020 CA-2; `src/db/realtime.db.test.ts` (payload = fila, sin cambios). Medición: `_qa/SPEC-041/ca1-explain-{antes,despues}.txt` | | ❌ |
| CA-2 | `src/model/public.ts`, `src/board/row.ts` | `src/model/public.test.ts` «SPEC-041 CA-2 …»; `src/board/row.test.ts` «SPEC-041 CA-2 …» (Z, lector = payload, postponed rechazado, vista vieja) | | ❌ |
| CA-3 | `src/app/config.ts`, `src/xornada/recent-goal.ts`, `src/xornada/view.ts`; páginas `src/app/{xornada-home,xornada-week,demo-xornada}.tsx` → `XornadaScreen` → `XornadaBody`/`XornadaLive` | `src/xornada/recent-goal.test.ts` «recentGoals» (11 casos); `src/app/config.test.ts` «SPEC-041 CA-3 …»; `src/xornada/view.test.ts` «SPEC-041 CA-3 …» | | ❌ |
| CA-4 | `src/components/xornada/{MatchRow,RecentGoalScore}.tsx`, `Xornada.module.css` (.recentGoal, .recentGoalBox, .sidesTag, .goalTag, movimiento reducido), `src/i18n/{gl,es}.ts` | `src/components/xornada/recent-goal.test.ts` (2 variantes × gl/es × local/visitante/ambos/ninguno/6 min); `src/xornada/recent-goal.test.ts` «pulseIterations» | | ❌ |
| CA-5 | `src/xornada/recent-goal.ts` (watchRecentGoal), `src/components/xornada/RecentGoalScore.tsx`, `XornadaLive.tsx` | `src/xornada/recent-goal.test.ts` «SPEC-041 CA-5 watchRecentGoal» (reloj doble); `src/components/xornada/recent-goal.test.ts` «CA-5 a new PublicMatch repaints the mark»; e2e: marca 1 s antes del fin, ninguna en el fin | | ❌ |
| CA-6 | `src/xornada/demo.ts` (demoMatches), páginas demo `force-dynamic`, `playwright.config.ts` (2.º servidor `label`) | `e2e/xornada-gol-reciente.spec.ts` (20 casos); `e2e/xornada-gol-reciente.db.spec.ts` (no ejecutado, F-SPEC-041-1); `src/xornada/demo.test.ts` «SPEC-041 CA-6 …» | | ❌ |
| CA-7 | — | Linux (playwright v1.63.0-noble, export LF de c3b16fc): `npm run gates` exit 0 (1941 tests, 107 ficheros; lint 0 errores, 1 warning previo en `src/arch/deploy.test.ts`); `npm run e2e` 233 passed, 1 skipped (solo-captura, previo). `git diff origin/main --stat -- src/sources src/decide src/ingest` vacío; `src/model`: solo `public.ts` y su test; `supabase`: solo la migración nueva. `test:db`/`e2e:db` completos: F-SPEC-041-1 | | ❌ |
## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-041/. Informe HTML opcional: _qa/SPEC-041/informe.html -->
Generadas en Linux con `QA_CAPTURE_DIR=/tmp/qa npx playwright test e2e/xornada-gol-reciente.spec.ts`.

| CA | Captura (`_qa/SPEC-041/`) |
|---|---|
| CA-4 box | `box-{gl,es}-{390,1440}.png` (página), `box-{gl,es}-{390,1440}-fila.png` (fila de Bilbao Athletic) |
| CA-4 label | `label-{gl,es}-{390,1440}.png`, `label-{gl,es}-{390,1440}-fila.png` |
| CA-4 movimiento reducido | `{box,label}-{gl,es}-390-movimiento-reducido-fila.png` |
| CA-5 vencida | `{box,label}-{gl,es}-{390,1440}-vencido-fila.png` |
| CA-1 presupuesto | `ca1-explain-antes.txt`, `ca1-explain-despues.txt` (semilla `ca1-seed.sql`, consulta `ca1-explain.sql`) |

Medición CA-1 (postgres:17.9 efímero, 60 partidos × 150 Decisions = 9000, tres pasadas en caliente): `matches()` (60 ids, `select *`) **antes 0,95 / 1,15 / 0,98 ms → después 8,81 / 8,54 / 11,81 ms** (presupuesto ≤ 50 ms). `index()` (sin las columnas nuevas) 0,49 → 0,52 ms: el planificador elimina el lateral nuevo.

## Salvedades / follow-ups
<!-- IDs F-SPEC-041-1, F-SPEC-041-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-041-1 (no verificado: `test:db` completo y `e2e:db`).** Supabase local apagada y sin CLI; no se tocó la base compartida. Se corrieron `src/db/web.db.test.ts`, `src/db/realtime.db.test.ts` y `src/board/reader.db.test.ts` contra un postgres:17 aislado (contenedor propio, puerto 55441) con stubs de roles y esquemas de Supabase (`cron`, `vault`, `net`, `storage`, `realtime`; `_qa/SPEC-041/ca1-db-efimera-{stubs.sql,apply.sh}`, contenedor `postgres:17` con `-p 127.0.0.1:55441:5432`, base `t041`; vitest con `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55441/t041 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npx vitest run --config vitest.db.config.mts <ficheros>`): 65 passed, 14 failed; los 14 son del entorno (USAGE de `public` y RLS de `realtime.messages` que pone la imagen de Supabase) y fallan igual sin la migración; todos los casos de SPEC-041 y el del payload de `board_delta` en verde. Rojo comprobado antes de aplicar la migración (31 fallos = 13 del entorno + 18 de SPEC-041). Pendiente en local: `supabase start`, `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` y `npm run e2e:db` (nuevo: `e2e/xornada-gol-reciente.db.spec.ts`, polling con el socket cerrado). Destino: verificador.
- **F-SPEC-041-2 (desviación: la variante en e2e).** «La variante se cambia en el build de prueba»: un solo `next build` servido dos veces; el segundo `next start` (puerto 3101) lleva `E2E_RECENT_GOAL_MARK=label`, que `recentGoalMark(env)` de `src/app/config.ts` lee al render (páginas dinámicas o ISR). Sin la variable, o con un valor que no es variante, `RECENT_GOAL_MARK` (`"box"`). Producción la honraría si alguien la pusiera. Destino: titular (aceptar, o dos builds).
- **F-SPEC-041-3 (desviación: dónde vive el temporizador).** Un temporizador por marca (`RecentGoalScore`, cliente), no uno solo en `XornadaLive`: así vencen también la demo y las páginas de semana, que no llevan el cliente de SPEC-024. `XornadaLive` le pasa su instante; la marca toma el reloj del navegador al montar. Destino: verificador.
- **F-SPEC-041-4 (test de otra spec).** `src/design/tokens.test.ts` (SPEC-023 CA-7, «única anchura consultada») filtra ahora las `@media` con `width`: `prefers-reduced-motion` no es una anchura. Destino: verificador.
- **F-SPEC-041-5 (datos de la demo).** Bilbao Athletic – UD Ourense pasa de 0-0 a 1-0 (sigue `live` 67' `sen_sinal`) para que el nombre más largo lleve marca; la demo se renderiza por petición (`dynamic = "force-dynamic"`). Ningún e2e previo dependía de ese marcador.
- **F-SPEC-041-6 (N-1 despliegue).** El código nuevo con la vista vieja deja fuera todas las filas (falta la columna; test en `row.test.ts`). La migración va antes, como dice N-1.
- **F-SPEC-041-7 (N-2, D-8).** Primera animación de la pantalla y pastilla «GOL» sin diseño en `docs/diseno/`: revisión de diseño pendiente con las capturas. El recuadro `box` sobre `--bg-step` es discreto en tema oscuro (`box-*-fila.png`). Destino: titular.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-7 implementados y con test. Commits 78fdef3 (CA-2), 82770ea (CA-1), b289b55 (CA-3), d15bb35 (CA-4, CA-5 y datos de la demo), bc3a68a (CA-6 e2e), estilo Biome, c3b16fc (e2e y capturas). Sin push.
- Gates de referencia en Linux: `git -c core.autocrlf=false archive HEAD` copiado a un contenedor `mcr.microsoft.com/playwright:v1.63.0-noble`, `npm ci`, `npm run gates`, `CI=1 npm run e2e`.
- Falta: `test:db` completo y `e2e:db` contra Supabase local (F-SPEC-041-1); revisión de diseño (F-SPEC-041-7).
