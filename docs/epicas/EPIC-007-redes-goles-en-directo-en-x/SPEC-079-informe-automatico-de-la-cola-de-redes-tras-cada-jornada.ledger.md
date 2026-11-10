---
id: SPEC-079
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-079 Informe automático de la cola de redes tras cada jornada

## Resumen
- Fase: en-revision (implementación terminada el 2026-11-10; CA-6 es posterior a la fusión)
- Rama: `ft/SPEC-079-informe-de-redes`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/social/report.ts` (`expectedGoals`, `buildReport`, `renderMarkdown`; tipos `ReportMatch`, `ReportDecision`, `ReportPost`, `Report`, `Watched`); no importa `src/ingest/goal-events.ts` | `src/social/report.test.ts` (28: tabla de los 8 casos de SPEC-066 CA-2 + equipo no vigilado; orden por `version`; partido fuera de ventana; temporada del partido; `OK` seco y encendido; ventana vacía; recuento y textos; una desviación por caso: esperado sin fila, sobrante, duplicado, `pending`/`sending`/`failed`/`expired`/`skipped·not_watched` sobre esperado, mezcla `sent`+`disabled`, `goal_annulled` fuera de lo admitido; `renderMarkdown` contiene toda hoja string/number del `JSON.stringify`) | | ❌ |
| CA-2 | `src/social/report-db.ts` (`reportRows`: `sql.begin("read only")`, partidos por `kickoff` en `[from, to)` con nombres y `season`, todas las Decisions por `version`, `social_posts`; `Date` → ISO `Z`) | `src/social/report-db.db.test.ts` (4, Supabase local: solo entra el partido de dentro, 3 Decisions por `version` incluida la decidida antes de la ventana, fila `pending` sigue `pending` con `attempts = 0`, ventana vacía, el fichero sin `insert`/`update`/`delete` y con `"read only"`) | | ❌ |
| CA-3 | `tools/social-informe.mjs` (`parseArgs`, `githubOutput`, `redact`, `main`), `package.json` (`social:informe`), `src/calendar/galicians.ts` (import attributes `with { type: "json" }`, F-SPEC-079-1) | `src/social/social-informe.test.ts` «CA-3» (18: por defecto 4 días; `--dias`/`--json`/`--issue`; `--desde`/`--hasta` normalizados a `Z`; tabla de rechazos: `--dias 0`, `--dias x`, `--dias` sin valor, `--desde` sin `--hasta`, `--hasta` sin `--desde`, orden invertido, no ISO, `--dias` + `--desde`, opción desconocida, argumento suelto; `GITHUB_OUTPUT` con `SIN_PARTIDOS`; script npm; sale 1 con el uso antes de `DATABASE_URL`; sale 1 sin `DATABASE_URL`; `127.0.0.1:1` con contraseña centinela → 1 y la centinela no sale) | | ❌ |
| CA-4 | `tools/social-informe.mjs` (`publishIssue`, `issueTitle`, `issueBody`, `asegurarEtiqueta`, `enlaceEjecucion`, `ETIQUETA = "redes"`, `TITULAR = "albertofojo"`; `gh` inyectable) | `src/social/social-informe.test.ts` «CA-4» (7, `gh` falso: mismo día = 1 `create` + 1 `edit`, día siguiente `create` nuevo; crea la etiqueta si falta, asigna al titular, veredicto en la primera línea, enlace a la ejecución; etiqueta existente → sin `label create` y el `edit` lleva el cuerpo nuevo; issue cerrada del día → `create`; sin partidos → 0 llamadas; `--issue` sin `GH_TOKEN`/`GH_REPO` → 1 antes de la base; `enlaceEjecucion`) | | ❌ |
| CA-5 | `.github/workflows/informe-redes.yml` (schedule `0 6 * * 2,5`; `workflow_dispatch` con `dias`=`4`, `desde`, `hasta`; `permissions` `contents: read`, `issues: write`; `concurrency: informe-redes` sin cancelación; `defaults.run.shell: bash`; máscara antes de `DATABASE_URL`; paso informe y paso `--issue`; `SOCIAL_WATCHED_TEAMS: ${{ vars.SOCIAL_WATCHED_TEAMS }}`) | `src/arch/informe-redes-workflow.test.ts` (15, YAML sin comentarios: un job; cron y dispatch; inputs; concurrency; permissions; timeouts ≤ 10; solo `DATABASE_URL` y `GITHUB_TOKEN`; máscara antes del primer paso que ve la URL; sin `${{` en `run:`; bash; informe y luego `--issue`; `DIAS`/`DESDE`/`HASTA` al entorno; `vars.SOCIAL_WATCHED_TEAMS`; sin `supabase`/`db:push`/`vercel`/git/`data/`; checkout sin credenciales y `npm ci`) | | ❌ |
| CA-6 | Pendiente: posterior a la fusión (`workflow_dispatch` con `desde`/`hasta` de la jornada 7-9 nov; lo lanza el orquestador o el titular). Pegar aquí URL de la issue, veredicto y modo | n-a (manual, tras fusionar) | | ❌ |
| CA-7 | `package.json`/`package-lock.json` 0.7.1 → 0.8.0 (`chore(release): 0.8.0`); `report.ts` y `report-db.ts` importan solo `src/model`, `src/social` y `postgres` | `src/arch/social-boundary.test.ts` verde (14); `git diff --stat origin/main -- src/decide src/ingest src/social/dispatch.ts` vacío; `node tools/version-gate.mjs --base origin/main` → ok 0.7.1 → 0.8.0; gates y `test:db` en «Evidencia del implementador» | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-079/. Informe HTML opcional: _qa/SPEC-079/informe.html -->

## Evidencia del implementador (2026-11-10, Windows 11, Node 22.19 local / `.nvmrc` 24)
- `npm run typecheck` ✅ · `npm run lint` ✅ (471 ficheros) · `npx vitest run`: 167 ficheros, **2784 pasan, 1 falla preexistente** (`src/db/test-db.test.ts › wins over a .env file in the cwd too`, solo Windows), 3 omitidos · `npm run build` ✅ (`✓ Compiled successfully`, con los import attributes de `galicians.ts`).
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`: 271 tests, 248 pasan, **23 fallan, todos en `src/ingest/*.db.test.ts`** (`engine` 14, `live-observed-only` 3, `replay-jornada` 3, `reconciliacion`, `reconciliacion-sin-directo`, `recuperacion-rfef`; api-football, preexistentes y ajenos a esta spec). `src/social/report-db.db.test.ts` 4/4 ✅.
- Ejecución real contra Supabase local: `node tools/social-informe.mjs --desde 2026-11-07 --hasta 2026-11-11` → Markdown con `Partidos: 0`, `Modo: seco`, `Veredicto: OK`, exit 0, `GITHUB_OUTPUT` = `partidos=0` / `veredicto=SIN_PARTIDOS`. Contra `127.0.0.1:1` → `connect ECONNREFUSED 127.0.0.1:1`, exit 1, 0,6 s.
- `node tools/version-gate.mjs --base origin/main` → «ok — 0.7.1 → 0.8.0, package-lock.json coherente».

## Salvedades / follow-ups
<!-- IDs F-SPEC-079-1, F-SPEC-079-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-079-1** (CA-3, fuera de los ficheros nombrados por la spec): `src/calendar/galicians.ts` gana `with { type: "json" }` en sus seis imports de JSON. Sin ellos, Node (sin bundler) no carga `src/social/config.ts` (`ERR_IMPORT_ATTRIBUTE_MISSING`) y la herramienta no podría usar `socialConfig` + `watchedTeams` como pide CA-1. tsc, Biome, Vitest y `next build` los aceptan. Alternativa descartada: duplicar `parseWatched` en la herramienta.
- **F-SPEC-079-2** (CA-5, diseño): el paso `--issue` vuelve a consultar la base (dos lecturas `read only` por ejecución) y añade `partidos=`/`veredicto=` por segunda vez a `GITHUB_OUTPUT` (sin `id`, inocuo). Si molesta, `--issue` podría leer el JSON del paso anterior.
- **F-SPEC-079-3** (verificador): la etiqueta `redes` se crea con color `1D76DB` y descripción «Informe de la cola de redes tras cada jornada (SPEC-079, ADR-032)», elegidos por el implementador.
- **F-SPEC-079-4** (CA-1, criterio): un `goal_annulled` vigilado `sent` en modo `encendido` o `skipped/disabled` en `seco` es admitido además de `skipped/goal_not_posted`; cualquier otro estado es desviación. En `encendido`, una fila `skipped/disabled` produce dos líneas (la suya y «mezcla de sent y skipped/disabled»).
- **F-SPEC-079-5** (CA-6): posterior a la fusión; requiere la variable de repo `SOCIAL_WATCHED_TEAMS` solo si se recortó en Vercel (H-3). No se tocó ningún secreto ni variable de GitHub.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Rama `ft/SPEC-079-informe-de-redes` sobre `origin/main` 41f0e0f (0.7.1), commits: docs aprobada, CA-1, CA-2, CA-3, CA-4, CA-5, `chore(release): 0.8.0`, ledger/en-revision. Sin push ni PR.
- Hecho: CA-1..CA-5 y CA-7. Pendiente: CA-6 (tras fusionar: `gh workflow run informe-redes.yml -f desde=2026-11-07T00:00:00Z -f hasta=2026-11-10T00:00:00Z`; pegar aquí URL de la issue, veredicto y modo; si `OK` en `seco`, el titular la enlaza en SPEC-067 CA-6).
- En local: `DATABASE_URL=… node tools/social-informe.mjs --dias 4 [--json]`; `--issue` necesita `GH_TOKEN` y `GH_REPO`.
