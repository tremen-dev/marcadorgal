---
id: SPEC-066
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-066 Goles a la cola de redes: detección, outbox, publicador con doble, plantillas y configuración

## Resumen
- Fase: en-revision (implementación terminada el 2026-11-09; pendiente de sdd-verificador)
- Rama: `ft/SPEC-066-goles-a-la-cola-de-redes`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `supabase/migrations/20261109120000_spec066_social_posts.sql` | `src/social/schema.db.test.ts` (defaults, 23505, 23514, 23503, índice parcial, RLS sin políticas, `web_reader` 42501); `src/db/schema.db.test.ts` (inventario con `social_posts`); `src/db/web.db.test.ts` inventario ADR-015 §3 sigue verde | | 🚧 |
| CA-2 | `src/ingest/goal-events.ts` (`goalEvents`) | `src/ingest/goal-events.test.ts` (tabla de 15 casos) | | 🚧 |
| CA-3 | `src/ingest/engine.ts` (`insertDecision` devuelve `id`; `decideLocked(..., social)`), `src/ingest/social-outbox.ts` (`queueSocialPosts`, savepoint + log de una línea) | `src/ingest/engine.db.test.ts` «SPEC-066 CA-3» (fila por evento con `decision_id`; dos motores concurrentes = una fila; `decideRecovered` y `aplicarCorrecciones` = ninguna; tabla renombrada = Decision escrita + 1 línea de log); dobles de `engine.test.ts` y `recuperacion-rfef-db.test.ts` adaptados a `returning id` | | 🚧 |
| CA-4 | `src/social/publisher.ts` (`SocialPublisher`, `PublishResult`, `PUBLISHERS` vacío, `createMemoryPublisher`) | `src/social/publisher.test.ts` | | 🚧 |
| CA-5 | `src/social/dispatch.ts` (`dispatchSocial`), `src/social/port.ts` (`SocialDb`), `src/social/memory.ts`, `src/social/db.ts` (postgres.js: `expire`, `claim` con `for update skip locked`, `finish`) | `src/social/dispatch.test.ts` «CA-5» (sent/rejected/retry×3/unknown/throw; texto idéntico en reintento); `src/social/db.db.test.ts` (claim+contexto, finish, dos despachos concurrentes = una llamada por fila) | | 🚧 |
| CA-6 | `src/social/dispatch.ts` (`POST_TTL_MINUTES`, `MAX_POSTS_PER_TICK`, `PUBLISH_TIMEOUT_MS`), `src/social/db.ts` (`expire`) | `src/social/dispatch.test.ts` «CA-6» (pending→expired, sending→failed unknown_outcome, 6 filas = 4 llamadas, timeout 5 s con reloj falso); `src/social/db.db.test.ts` «CA-6 expire» | | 🚧 |
| CA-7 | `src/social/dispatch.ts` (`decideClaim`: not_watched, goal_not_posted) | `src/social/dispatch.test.ts` «CA-7» (no vigilado sin texto y fuera del tope; anulado solo tras `sent` o `skipped/disabled`; último gol por `created_at`) | | 🚧 |
| CA-8 | `src/i18n/social.gl.ts` (6 `goal`, 3 `goal_annulled`), `src/social/text.ts` (`renderSocialText`, `minuteLabel`) | `src/social/text.test.ts` (sobre todas: nombres, marcador, minuto `45+2'`, sin contracción ante `{team}`, sin `@`, minuto nulo limpio, ≤ 250 con el nombre más largo de `data/calendario/2026-27/` y ligazón) | | 🚧 |
| CA-9 | `src/social/pick.ts` (`pickTemplate`, `seededRng`) | `src/social/pick.test.ts` (determinista; 1.000 tiradas sin excluidas y con todas las demás); `src/social/dispatch.test.ts` «CA-9» (exclusión del último del equipo por `kind` y del último de la cuenta) | | 🚧 |
| CA-10 | `src/social/config.ts` (`socialConfig`, `watchedTeams`), `.env.example` | `src/social/config.test.ts` (tabla: publicador, equipos, ligazón, `.env.example`); `src/social/dispatch.test.ts` «CA-10 dry mode» (apagado = `skipped/disabled` con texto, doble sin llamadas, ligazón última línea) | | 🚧 |
| CA-11 | `src/ingest/tick.ts` (`social?: SocialDispatch`, `TickSummary.social/socialError`, corre en todo tick), `src/app/social.ts` (`createSocialDispatch`), `src/app/api/ingest/tick/route.ts` (cableado) | `src/ingest/tick.test.ts` «SPEC-066 CA-11» (sin ventana corre; tras el barrido; si lanza → `socialError` y barrido/intentos intactos; sin hook nada y `tools/ingest-tick.mjs` sin `social`); `src/app/social.test.ts` (fila caducada queda `expired`; apagado redacta; propaga fallo); `src/app/api/ingest/tick/route.test.ts` «SPEC-066 CA-11» (la ruta pasa `social` a `runTick`, 200) | | 🚧 |
| CA-12 | `src/arch/social-boundary.ts` | `src/arch/social-boundary.test.ts` (checker + árbol); `git diff origin/main -- src/decide` vacío; gates y `test:db`: ver evidencia abajo; versión 0.3.1 → 0.4.0 (`chore(release): 0.4.0`) | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-066/. Informe HTML opcional: _qa/SPEC-066/informe.html -->

## Evidencia del implementador (2026-11-09, Windows, Node 22.19, Supabase local 17.11 en Docker)
- `npm run gates`: typecheck ✅ · `biome check .` ✅ (424 ficheros) · `vitest run` **1 fallo preexistente** (`src/db/test-db.test.ts › wins over a .env file in the cwd too`; idéntico en `origin/main` 93faaa1: el test compone `PATH` con `:` y en Windows no encuentra los fakes; CI Linux lo pasa) · `npm run build` ✅ (`✓ Compiled successfully`, `/api/ingest/tick` presente). Totales: 150 ficheros, 2432 pasan, 1 falla, 3 omitidos.
- `test:db` (`supabase start -x studio,imgproxy,inbucket,pg_meta,edge-runtime,vector,pooler`; `supabase db push --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` aplica `20261109120000_spec066_social_posts.sql`; `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<de supabase status> npx vitest run --config vitest.db.config.mts`): **24 fallos preexistentes en 7 suites de `src/ingest/*.db.test.ts`** (idénticos a la línea base medida antes de tocar código: observaciones de `api-football`, fuera del registro desde ADR-026); `src/social/schema.db.test.ts` 8/8, `src/social/db.db.test.ts` 5/5 (tres pasadas), `src/ingest/engine.db.test.ts › SPEC-066 CA-3` 5/5, `src/db/schema.db.test.ts` y `src/db/web.db.test.ts` verdes. Totales: 25 ficheros, 236 pasan, 24 fallan (línea base: 24 ficheros, 226 pasan, 24 fallan).
- `git diff origin/main -- src/decide` → 0 líneas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-066-1, F-SPEC-066-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-066-1** (EPIC-MANT): `src/db/test-db.test.ts › wins over a .env file in the cwd too` falla en Windows por `PATH` con `:` en vez de `path.delimiter`; preexistente en `main`. Hace que `npm run gates` no llegue a `build` en Windows (se corrió aparte, verde).
- **F-SPEC-066-2** (EPIC-MANT): 24 casos de `src/ingest/{engine,live-observed-only,informe,replay-jornada,recuperacion-rfef,reconciliacion,reconciliacion-sin-directo}.db.test.ts` fallan en `main` porque siembran observaciones de `api-football`, que ya no está en `SOURCES` (ADR-026). No se tocaron; los nuevos casos de SPEC-066 usan `rfef`.
- **F-SPEC-066-3** (cerrada aquí): el inventario de tablas de `src/db/schema.db.test.ts` no incluía `match_goals` (SPEC-060); se añadió junto a `social_posts`. `truncate decisions` se prueba junto a `social_posts` porque la FK responde antes que el trigger append-only.
- **F-SPEC-066-4** (orquestador): la rama partía de 13409a4 (#110) y `origin/main` ya tenía #111 y #112 (versión 0.3.1); se hizo fast-forward a 93faaa1 antes del primer commit para que el `minor` sea 0.4.0 y no colisione. El `docs/tablero.md` modificado en local (no era de esta rama, ya obsoleto) quedó como en `main`; su diff está en `C:/Users/Albert/AppData/Local/Temp/claude/0ccd32c5939f7201/54982956-f7d2-4ef4-904f-ce3f9e4cb266/scratchpad/tablero-local.patch` y en el stash `spec066-docs` (`git stash list`; se puede soltar). `docs/epicas/EPIC-008-*/` sigue sin trackear, intacto.
- **F-SPEC-066-5** (verificador): CA-11 «si el despacho lanza, el tick responde 200 y las Decisions están escritas» está probado con dobles (`runTick` + handler) y el cableado de la ruta con `runTick` mockeado; no se ejecutó `POST /api/ingest/tick` real contra la base local. Comando sugerido: `npm run dev` con `.env` apuntando a la Supabase local y `curl -X POST -H "Authorization: Bearer <INGEST_TICK_TOKEN>" http://localhost:3000/api/ingest/tick` → el resumen lleva `social: {sent,failed,retried,expired,skipped}`.
- **F-SPEC-066-6** (SPEC-067): `PUBLISHERS` está vacío; `socialConfig` acepta un id solo si está en el registro, así que en producción esta spec es siempre modo seco. H-5: los textos de `src/i18n/social.gl.ts` los revisa el titular en el PR.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Rama `ft/SPEC-066-goles-a-la-cola-de-redes`, sobre `origin/main` 93faaa1, con 15 commits (docs, CA-2, CA-1, formato, CA-3, CA-4, CA-8, CA-9, CA-10, CA-5/6/7, SocialDb, CA-11, CA-12, `chore(release): 0.4.0`, ledger). Sin push ni PR.
- Hecho: los 12 CA con test; `src/decide/` intacto; migración solo-crea; `.env.example` con las tres variables.
- Falta: verificación (sdd-verificador). Para `test:db` en esta máquina: `supabase start -x studio,imgproxy,inbucket,pg_meta,edge-runtime,vector,pooler`, luego `supabase db push --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` y `DATABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<supabase status> npx vitest run --config vitest.db.config.mts src/social src/ingest/engine.db.test.ts src/db` (las 24 roturas preexistentes de F-SPEC-066-2 están fuera de ese filtro salvo las 14 de `engine.db.test.ts`, que son las de `api-football`).
- Diseño: `src/social/port.ts` es el puerto; `db.ts` lo implementa con `begin` o `savepoint` según reciba `Sql` o `TransactionSql`; `dispatch.ts` para el tick en el primer `retry`; `app/social.ts` es el único sitio donde ingest y social se encuentran. SPEC-067 añade `buffer` a `PUBLISHERS` y nada más.
