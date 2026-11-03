---
id: SPEC-045
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-045 Cabos sueltos de la xornada: diseño de escritorio, contexto, nombres de competición y suites con base

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-045-cabos-sueltos-xornada` (worktree `marcadorgal-infra`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/contexto.md`: líneas SPEC-040 (lateral retirado, ADR-022 Anexo A), SPEC-041, SPEC-042; SPEC-028 y SPEC-033 anotan qué las sustituye; «Última actualización» 2026-11-03 (`540f0ef`) | `grep -n "SPEC-040\|SPEC-041\|SPEC-042\|lateral" docs/fundacion/contexto.md` → líneas 5, 52, 53, 55, 56, 57 (ver Evidencia) | ✅ diff de `contexto.md` leído: 3 líneas nuevas (040 con lateral retirado + ADR-022 Anexo A, 041, 042), 028/033 anotadas, fecha 2026-11-03 | ✅ |
| CA-2 | `docs/diseno/Escritorio.tpl.html` (sin lateral, panel ni ★; rejilla `repeat(auto-fill, 360px)`, gap/padding 16, `align-items: start`; cabecera nombre·xornada·contador en palabras·flecha; margen 72 px), `Movil.tpl.html` (margen de dos líneas), `_logic.js` (nombres canónicos «… · Grupo 1»), `.dc.html` con `node build.mjs`, `HERENCIA.md` (`6943d21`) | `src/design/artboards.test.ts` (9 casos: sin lateral/panel/★; rejilla y 3 columnas a 1440; cabecera; regla CA-3; margen 72 px y línea 2 mono 500 10 px/1.2 en Escritorio y Movil; Global/Escritorio/Movil tpl+`_logic.js` = `.dc.html` byte a byte); `tokens.test.ts` verde | ✅ `artboards.test.ts` 9/9 en gates; tpl+`_logic.js`=`.dc.html` recomprobado con node (3/3 true); mutación (1 byte en `Escritorio.dc.html`) → 1 failed; Movil en `origin/main` no tenía `72px` (test no vacío); sin captura del artboard (F-6, admitido por el CA) | ✅ |
| CA-3 | `src/components/xornada/competition-name.ts` (`competitionNameSegments`), `CompetitionSection.tsx` (segmentos `nowrap`), `Xornada.module.css` (`.nameSegment`; en escritorio el nombre mide su segmento más ancho, hueco 6 px, sin espaciador, contador con `margin-left: auto`, `flex-wrap`) (`990c97f`) | `competition-name.test.ts` (4 casos); `e2e/xornada-columnas.spec.ts` «SPEC-045 CA-3 at {360…2200}px» ×2 idiomas (16 casos); capturas `_qa/SPEC-045/nombres-{gl,es}-{1024,1920}.png` | ✅ corrida propia `-g "SPEC-045 CA-3"` 16 passed; mutación `.nameSegment` → `white-space: normal` → 4 failed (1024/1920 gl+es); capturas propias `verif-nombres-{gl,es}-{1024,1920}.png`: «· GRUPO 1» entero en la 2.ª línea | ✅ |
| CA-4 | — (sin código: se corre la suite) | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` → exit 0, `Test Files 21 passed (21)` · `Tests 233 passed (233)` (ver Evidencia) | ✅ corrida propia: CLI 2.122.0, `Local database is up to date.`, `Test Files 21 passed (21)`, `Tests 233 passed (233)`, exit 0 | ✅ |
| CA-5 | `e2e/xornada-realtime.db.spec.ts` (F-SPEC-045-1, F-SPEC-045-2, `40e85af`), `e2e/xornada-nav.db.spec.ts` (F-SPEC-045-3, `cfe811c`) | `npm run e2e:db` → exit 0, 48 passed · 1 skipped (captura sin `QA_CAPTURE_DIR`) (ver Evidencia) | ✅ corrida propia `npm run e2e:db` exit 0: 48 passed, 1 skipped («QA captures of / and /es at 390 px»); por fichero gol-reciente 1 · nav 16 · realtime 7 · weeks 17 · xornada 8 (7+1 skip) | ✅ |
| CA-6 | F-SPEC-045-1..3: solo e2e; sin migración, sin tocar ficheros fuera de CA-8 | Rojo antes (logs de las corridas 1-3) y verde después (corrida final `cfe811c`); repetición `--repeat-each=5` del caso de F-3 → 10 passed | ✅ diff de los 3 e2e leído: F-1 solo ignora `animation-iteration-count` (reloj), F-2 elige otra competición `:visible`, F-3 añade una espera de hidratación; ninguna aserción eliminada ni relajada; sin migraciones | ✅ |
| CA-7 | Ledgers de SPEC-040 y SPEC-041: una línea fechada 2026-11-03 en «Salvedades / follow-ups» (`a0e49ba`) | `git diff 9a8d76d a0e49ba -- docs/epicas/EPIC-003-xornada-publica/*.ledger.md` → 2 inserciones, 0 borrados; veredictos y frontmatters intactos | ✅ `git diff origin/main` de los ledgers 040/041: +1/-0 cada uno, solo la línea fechada | ✅ |
| CA-8 | Solo `docs/diseno/`, `contexto.md`, `src/components/xornada/`, tests, e2e, ledgers 040/041/045, capturas; sin dependencias | Linux (`mcr.microsoft.com/playwright:v1.63.0-noble`, export LF de `cfe811c`): `npm run gates` exit 0 y `CI=1 npm run e2e` exit 0 (ver Evidencia); `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/model src/app/api supabase` vacío; `package.json`/`package-lock.json` sin diff | ✅ export LF de `da510e6` en playwright v1.63.0-noble: gates exit 0 (Biome 327, Vitest 119 ficheros 2142 passed/3 skipped, build ok); `CI=1 npm run e2e` exit 0 249 passed/1 skipped; stat de dirs vetados vacío; sin `package*.json` ni ficheros de SPEC-039; sin hex ni `font:` añadidos bajo `src/` | ✅ |

## Evidencia del implementador
Entorno: Windows + Docker Desktop (engine 29.0.1). Supabase **local** (`project_id = marcadorgal`), CLI **2.122.0** (`supabase start` con el binario de la caché de npx en Windows; dentro del contenedor, `npm i -g supabase@2.122.0` + `docker-cli`). Suites en Linux: contenedor `mcr.microsoft.com/playwright:v1.63.0-noble` (node 24.20.0) con `--network host` y el socket de Docker, sobre `git -c core.autocrlf=false archive HEAD`. Nunca se usó la base remota.

`supabase status -o env` (claves tapadas):
```
API_URL="http://127.0.0.1:54321"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
REST_URL="http://127.0.0.1:54321/rest/v1"
STORAGE_S3_URL="http://127.0.0.1:54321/storage/v1/s3"
ANON_KEY=<redactada>  SERVICE_ROLE_KEY=<redactada>  SECRET_KEY=<redactada>
PUBLISHABLE_KEY=<redactada>  JWT_SECRET=<redactada>  S3_PROTOCOL_ACCESS_KEY_*=<redactada>
```

CA-1 — `grep -n "SPEC-040\|SPEC-041\|SPEC-042\|lateral" docs/fundacion/contexto.md`:
```
5:> Última actualización: 2026-11-03 (SPEC-040, SPEC-041 y SPEC-042 al día en EPIC-003: el lateral de escritorio está retirado; SPEC-045 en curso).
52:- **SPEC-028:** el lateral lleva a su competición, … *El lateral lo retira SPEC-040 (ADR-022 Anexo A); el logo y el título siguen.*
53:- **SPEC-033:** … *La cabecera por día la sustituye SPEC-040: fecha y hora en cada fila.* …
55:- **SPEC-040:** fecha y hora por fila … **El lateral «Competicións» queda retirado en escritorio** (ADR-022 Anexo A); …
56:- **SPEC-041:** gol reciente que pulsa. …
57:- **SPEC-042:** la marca de gol reciente es `label` …
```

Corrida final sobre `cfe811c` (Linux):
| Comando | Resultado |
|---|---|
| `npm run gates` | exit 0 · Biome `Checked 327 files` · Vitest `119 files`, `2142 passed \| 3 skipped` · build ok |
| `CI=1 npm run e2e` | exit 0 · `249 passed`, `1 skipped` |
| `npm run e2e:db` | exit 0 · `48 passed`, `1 skipped` (2.7 min) |
| `DATABASE_URL=…127.0.0.1:54322/postgres npm run test:db` | exit 0 · `Local database is up to date.` · `Test Files 21 passed (21)` · `Tests 233 passed (233)` |
| `npx playwright test --config playwright.db.config.ts e2e/xornada-nav.db.spec.ts -g "CA-4 with JS" --repeat-each=5` | exit 0 · `10 passed` |

`e2e:db` por fichero (corrida final): `xornada-gol-reciente.db.spec.ts` 1 passed · `xornada-nav.db.spec.ts` 16 passed · `xornada-realtime.db.spec.ts` 7 passed · `xornada-weeks.db.spec.ts` 17 passed · `xornada.db.spec.ts` 7 passed, 1 skipped («QA captures of / and /es at 390 px», sin `QA_CAPTURE_DIR`).

Rojo antes (CA-6):
| Corrida | Código | Resultado |
|---|---|---|
| 1 · suite completa | `a0e49ba` (código = `main`) | `e2e:db` exit 1: 46 passed, 2 failed (`xornada-nav.db` es «CA-4 with JS» → `filter-finished` sin `aria-current`; `xornada-realtime.db` «CA-5 on» → `locator.click` timeout sobre una sección oculta), 1 skipped. `test:db` exit 0, 21/233 |
| 2 · solo nav + realtime | `a0e49ba` | exit 1: 22 passed, 1 failed (`xornada-realtime.db` «CA-10 … aborted» → `animation-iteration-count:299` vs `298`) |
| 3 · suite completa | `40e85af` (F-1, F-2) | `e2e:db` exit 1: 47 passed, 1 failed (`xornada-nav.db` gl «CA-4 with JS»; traza: `navigated to "http://localhost:3110/"`, sin `#d=2026-10-31&f=finished`) · `test:db` 21/233 |

CA-3 rojo: `CI=1 npx playwright test e2e/xornada-columnas.spec.ts -g "SPEC-045 CA-3"` sobre `a0e49ba` + el e2e nuevo → 16 failed (sin segmentos); tras el cambio de cabecera, `e2e/xornada-columnas.spec.ts` completo → 57 passed.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-03 (sdd-verificador), HEAD `da510e6`.** Corrida propia en contenedor nuevo `sdd045v` (`mcr.microsoft.com/playwright:v1.63.0-noble`, `--network host`, socket de Docker) sobre `git -c core.autocrlf=false archive da510e6`, Supabase **local** (CLI 2.122.0); la remota no se tocó.

| Comando | Resultado |
|---|---|
| `npm run gates` | exit 0 · `Checked 327 files` · `Test Files 119 passed (119)` · `Tests 2142 passed \| 3 skipped (2145)` · `Compiled successfully` |
| `CI=1 npm run e2e` | exit 0 · `249 passed`, `1 skipped` |
| `DATABASE_URL=…127.0.0.1:54322/postgres npm run test:db` | exit 0 · `Test Files 21 passed (21)` · `Tests 233 passed (233)` |
| `npm run e2e:db` | exit 0 · `48 passed`, `1 skipped` · `Finished supabase db reset.` |
| `QA_CAPTURE_DIR=… CI=1 npx playwright test e2e/xornada-columnas.spec.ts -g "SPEC-045 CA-3"` | exit 0 · `16 passed` |
| Mutación CA-2: `Escritorio.dc.html` + 1 byte → `vitest run src/design/artboards.test.ts` | `1 failed \| 8 passed` (revertido) |
| Mutación CA-3: `.nameSegment { white-space: normal }` + build → CA-3 a 1024/1920 | `4 failed` (revertido) |

Hallazgos (no bloquean):
- **V-1 (F-SPEC-045-5, diseño).** Cabecera de escritorio: hueco 9→6 px, sin espaciador, `flex-wrap`, contador con `margin-left: auto`. Cabe en la spec aprobada: CA-3 obliga a que el nombre quepa en ≤ 2 líneas, CA-8 permite tocar `src/components/xornada/` y CA-2 exige que el artboard dibuje lo implementado, y lo dibuja igual (gap 6, `width: min-content`); D-8 queda coherente. Es un cambio visual menor no enumerado en la spec: queda para revisión de diseño del titular, sin gate.
- **V-2 (cosmético).** `artboards.test.ts` usa `it.each` con dos `%s` y un solo argumento: el título sale «reproduce undefined.dc.html». La aserción es correcta (mutación detectada). Destino: EPIC-MANT.
- **V-3 (entorno).** F-SPEC-045-4 confirmado por diseño del entorno: las suites con base solo se corrieron en Linux. Destino EPIC-MANT, ya anotado.

- **Cierre post-merge 2026-11-03 (sdd-verificador).** PR #93 fusionada en main, merge `bd0cd54`; runs de main en `bd0cd54`: `ci` success, `migraciones` success; https://marcador.gal responde 200.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-045/. Informe HTML opcional: _qa/SPEC-045/informe.html -->
| CA | Captura | Qué se ve |
|---|---|---|
| CA-3 | `_qa/SPEC-045/verif-nombres-gl-1024.png`, `verif-nombres-es-1024.png` | 2 columnas; «PRIMEIRA/TERCEIRA/SEGUNDA FEDERACIÓN» en línea 1 y «· GRUPO 1» entero en línea 2; sin elipsis ni scroll |
| CA-3 | `_qa/SPEC-045/verif-nombres-gl-1920.png`, `verif-nombres-es-1920.png` | 5 columnas en una fila, mismo corte |
| CA-3 | `_qa/SPEC-045/nombres-{gl,es}-{1024,1920}.png` (implementador) | coinciden con las del verificador |
| CA-2 | — | artboard no renderizable sin `support.js` (F-SPEC-045-6, admitido por el CA) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-045-1, F-SPEC-045-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-045-1 (SPEC-041, e2e).** `xornada-realtime.db` «CA-10 … aborted» comparaba el `outerHTML` de las filas; desde SPEC-041 la marca de gol reciente recuenta `animation-iteration-count` con el reloj del navegador al montarse (299 → 298). El test ignora ahora ese estilo, como ya ignoraba la edad de fila. Rojo en la corrida 2, verde en la final.
- **F-SPEC-045-2 (SPEC-040/041, e2e).** `xornada-realtime.db` «CA-5 on» plegaba la primera otra competición del DOM; con `#f=live` una competición sin directo no se pinta (SPEC-040 CA-4) y, con la suite completa (que desde SPEC-041 incluye `xornada-gol-reciente.db.spec.ts` antes), la primera quedaba oculta. Ahora pliega una visible. Rojo en la corrida 1, verde en la 3 y la final.
- **F-SPEC-045-3 (carrera del test, no atribuible a 040-042).** `xornada-nav.db` «CA-4 with JS» fijaba `#d=…&f=finished` con un `goto` del mismo documento y recargaba; si llegaba antes de hidratar, el `replaceState` inicial de Next (`app-router.js`, URL canónica sin fragmento) lo borraba y el reload iba a `/`. Intermitente (es en la corrida 1, gl en la 3). El test espera ahora a que `freshness` deje `data-transport="served"`. Verde en la final y 10/10 con `--repeat-each=5`.
- **F-SPEC-045-4 (entorno).** En Windows, `tools/test-db.mjs` y `playwright.db.config.ts` lanzan `supabase` y `npx` con `spawnSync` sin shell → `ENOENT` (los `.cmd` no se resuelven). La CLI no está en `devDependencies` y `npx --no-install supabase` da **3.0.0** (caché de npx), no 2.122.0. Por eso `test:db` y `e2e:db` se corrieron en Linux (contenedor con red del host y socket de Docker). Destino: EPIC-MANT, junto a F-SPEC-040-2.
- **F-SPEC-045-5 (diseño, CA-3).** «PRIMEIRA FEDERACIÓN» mide 156 px y no cabía en la cabecera de 360 px junto a xornada, contador y flecha (quedaban 147-153 px). En escritorio la cabecera pasa a hueco 6 px (antes 9), sin espaciador y con `flex-wrap` de seguridad; el artboard lo dibuja igual. Destino: titular (revisión de diseño).
- **F-SPEC-045-6 (CA-2).** Los artboards no se pueden renderizar: el repo no trae `support.js`. Sin captura del artboard; anotado en `HERENCIA.md`. El artboard pinta seis celdas (dos filas de tres columnas), las que entran en 900 px.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-8 implementados con evidencia. Commits `540f0ef` (CA-1), `a0e49ba` (CA-7), `990c97f` (CA-3), `6943d21` (CA-2), `40e85af` y `cfe811c` (CA-6: F-1..F-3). Spec en `en-revision`.
- Reproducir: `supabase start` (CLI 2.122.0); contenedor `docker run -d --name sdd045 --network host -v /var/run/docker.sock:/var/run/docker.sock mcr.microsoft.com/playwright:v1.63.0-noble sleep infinity`, `git -c core.autocrlf=false archive HEAD | docker exec -i sdd045 tar -x -C /w`, dentro `apt-get install docker-cli`, `npm i -g supabase@2.122.0`, `npm ci`, y los comandos de la tabla. `e2e:db` resetea la base local al terminar.
- Falta: verificación (sdd-verificador); revisión de diseño de F-SPEC-045-5.
