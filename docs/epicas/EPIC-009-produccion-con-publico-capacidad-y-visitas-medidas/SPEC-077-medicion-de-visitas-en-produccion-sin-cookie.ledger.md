---
id: SPEC-077
tipo: ledger
epica: EPIC-009
---
# Ledger — SPEC-077 Medición de visitas en producción sin cookie

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-077-medicion-de-visitas-en-produccion-sin-cookie`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `package.json` (`@vercel/analytics` `2.0.1` exacta, única dependencia nueva); `src/analytics/SiteAnalytics.tsx` (`shouldMeasure`, `SiteAnalytics`), `src/analytics/MeasuredAnalytics.tsx` (único importador del paquete); `<SiteAnalytics />` en `src/app/(gl)/layout.tsx` y `src/app/(es)/es/layout.tsx` | `src/analytics/site-analytics.test.ts`: tabla `production`→renderiza, `preview`/`development`/`""`/sin variable→`null`; lee `process.env.VERCEL_ENV` por defecto; ambos layouts montan `<SiteAnalytics />` y solo `analytics/MeasuredAnalytics.tsx` importa `@vercel/analytics` | | ❌ |
| CA-2 | `src/analytics/before-send.ts` (`beforeSend(event, { webdriver })`, puro), conectado en `MeasuredAnalytics.tsx` con `navigator.webdriver === true` | `src/analytics/before-send.test.ts`: `webdriver: true`→`null`; `/api`, `/api/board`, `/demo…`, `/es/demo…` (relativas y absolutas)→`null`; `/xornada/2026-11-15?x=1&utm_source=x#a`→`/xornada/2026-11-15?utm_source=x`; `/` y `/es` intactas; `/demolicion`, `/apia` no se filtran; no muta la entrada. En vivo: `e2e/analytics.spec.ts` «CA-3 the view leaves with the query filtered by beforeSend» | | ❌ |
| CA-3 | servidor e2e `:3104` con `VERCEL_ENV=production` en `playwright.config.ts` (`analyticsPort`); script real fijado en `e2e/fixtures/vercel-insights-script.js` | `e2e/analytics.spec.ts` «CA-3 `/` · `/es` · `/xornada/2026-12-12`: one view, same origin, no cookie, no storage» (3 casos) | | ❌ |
| CA-4 | el propio script (`navigator.webdriver` o «Headless» → no arranca) + `beforeSend` | `e2e/analytics.spec.ts` «CA-4 `/` · `/es` · `/xornada/2026-12-12`: zero views» (3 casos, `navigator.webdriver === true` comprobado) | | ❌ |
| CA-5 | carga diferida: el componente inyecta el script tras hidratar (`defer`), nada en el HTML | `e2e/analytics.spec.ts` «CA-5 the HTML of / carries no new script; the injected one is deferred»; First Load JS abajo. Campo `primera:pintura`: pendiente tras desplegar (procedimiento abajo) | | ❌ |
| CA-6 | `src/lib/legal/content.ts`: privacidad «3. Medición de audiencia» (gl/es, 4 párrafos), «Responsable» pasa a 4; cookies §1 reescrita («Sen cookies nin rastrexo» / «Sin cookies ni rastreo») + párrafo de Vercel Web Analytics; `lastUpdated` de privacidad y cookies → «10 de novembro/noviembre de 2026» | `src/lib/legal/content.test.ts` «audience measurement (SPEC-077 CA-6)» (5 casos). **Texto pendiente de aprobación del titular (G-4)** | | ❌ |
| CA-7 | — (campo; depende de H-1 y de una jornada) | procedimiento abajo, «CA-7 pendiente de campo» | | ❌ |
| CA-8 | versión `0.5.7` → `0.6.0` (`npm version minor --no-git-tag-version`) | evidencia abajo | | ❌ |

## Evidencia del implementador (2026-11-10)
| Comando | Resultado |
|---|---|
| `npx vitest run src/analytics src/lib/legal` | 26 + 9 tests en verde (antes de implementar: fallaban) |
| `npm run typecheck` (worktree LF `wt-077`, HEAD `ad90a0c`) | exit 0 |
| `npm run lint` (worktree LF) | exit 0, 450 ficheros |
| `npm run test` (worktree LF) | 160/161 ficheros, 2656 passed, 3 skipped, **1 failed**: `src/db/test-db.test.ts` «wins over a .env file in the cwd too», que falla igual en `d9db144` (base, sin cambios de esta rama): fallo de fondo de Windows (memoria del entorno). CI Linux es la referencia |
| `npm run build` (árbol principal) | exit 0 |
| `npx playwright test e2e/analytics.spec.ts` | 8 passed |
| `npx playwright test` (suite completa, árbol principal) | 306 passed, 1 skipped, 1 failed: `xornada-goleadores.spec.ts:152` «CA-4 … /demo/xornada at 1440 px» (pastilla temporizada, servidor :3100 sin analítica, `toHaveCount(1)` recibió 0 en 5 s). Reejecutado solo: `npx playwright test e2e/xornada-goleadores.spec.ts` 25 passed. Inestabilidad por carga (5 servidores, 8 workers), ajena a esta spec |
| `git diff origin/main --stat -- src/sources src/decide src/ingest` | vacío |
| Red en tests | ninguna: el script de insights se sirve desde la fixture y `/_vercel/insights/view` se responde con `context.route` |

**First Load JS** (scripts del HTML servido por `next start`, gzip; `tools/first-load-js.mjs` no sirve porque `/` es `force-dynamic` y no hay `index.html`; mismo cálculo sobre el HTML pedido):
- Antes (`d9db144`, `VERCEL_ENV=production`): `/` 10 scripts, 598,8 kB raw, **183,3 kB gzip**; `/es` igual.
- Después (`9a795bc`+, `VERCEL_ENV=production`): `/` 10 scripts, 602,9 kB raw, **185,0 kB gzip** (+1,7 kB ≤ 3 kB); `/es` igual. Con `VERCEL_ENV=development` el mismo 185,0 kB: el componente va en el chunk del layout aunque no se monte.

**Almacenamiento (CA-3):** `localStorage: []`, `sessionStorage: []` en `/`, `/es` y `/xornada/2026-12-12` (anotación `storage` de cada caso). El script solo *lee* `__va_attribution` y escribe solo con `identify`/`group`, que no usamos.

**Fixture del script:** copia de `https://va.vercel-scripts.com/v1/script.js` del 2026-11-10 (4 522 B, `sv` 0.1.3, sha256 `050e35bf7e6e96590f2a9de114c14ff792806ed28457b3248762944350c0ba4c`), excluida de Biome. En producción Vercel sirve el mismo script desde una ruta del propio dominio.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-077/. Informe HTML opcional: _qa/SPEC-077/informe.html -->

## Salvedades / follow-ups
- **F-SPEC-077-1 (CA-3/CA-4, user agent).** El script real no arranca si `navigator.webdriver` es verdadero **o** el User-Agent contiene «Headless». La e2e de CA-3 sobreescribe ambos (webdriver `false` y un UA de Chrome de escritorio); la de CA-4 no toca ninguno. Las sondas (`tools/sonda-pantalla.mjs`, `tools/primera-pintura.mjs`) quedan fuera por partida doble. Destino: ninguno, informativo.
- **F-SPEC-077-2 (CA-3, ISR compartida).** `/xornada/[fecha]` es ISR y los servidores e2e comparten `.next`: la e2e usa `/xornada/2026-12-12`, que ningún otro e2e visita, para que el HTML lo genere el servidor con `VERCEL_ENV=production`. Si otro e2e usa esa fecha, cambiarla. Destino: ninguno.
- **F-SPEC-077-3 (CA-6, coherencia).** Privacidad §1 sigue diciendo «cero rastrexo / non recompilamos datos de carácter persoal»; no contradice la medición agregada, pero el titular puede querer matizarlo al revisar G-4. Destino: revisión G-4.

## G-4 — Texto legal para aprobación del titular (antes del merge)
Fuente: `src/lib/legal/content.ts`. Se ve en `/privacidade`, `/es/privacidad`, `/cookies`, `/es/cookies`.

**Privacidade, «3. Medición de audiencia» (gl)**
1. Para saber canta xente consulta marcador.gal contamos as visitas con Vercel Web Analytics. Só se contan páxinas vistas agregadas por ruta, tipo de dispositivo, país e sitio de orixe da visita; non se constrúen perfís nin se segue a ninguén entre sitios.
2. Vercel é o provedor que aloxa esta web e actúa como encargado do tratamento. A medición viaxa polo propio dominio marcador.gal, sen peticións a dominios de terceiros.
3. Non se usa ningunha cookie nin se garda nada no teu navegador. Vercel non garda o teu enderezo IP: distingue as visitas cun identificador calculado en cada petición que descarta ás 24 horas, así que non pode recoñecerte dun día para outro.
4. Os navegadores automatizados (como as nosas propias sondas de proba) non contan, e dos enderezos só se conservan os parámetros de campaña (utm_*).

**Privacidad (es):** traducción literal de los cuatro párrafos (mismo orden).

**Cookies §1 (gl)** — título «1. Sen cookies nin rastrexo» (antes «Sen cookies de terceiros nin analítica invasiva»):
1. marcador.gal cumpre unha regra estrita: sen cookies, sen píxeles de seguimento e sen servizos que te sigan entre sitios. *(antes: «sen cookies de publicidade, sen píxeles de seguimento e sen analítica invasiva de terceiros»)*
2. *(nuevo)* A única medición de audiencia é Vercel Web Analytics, do mesmo provedor que aloxa a web: non usa cookies, non garda nada no teu navegador e só conta páxinas vistas agregadas. Detállase na política de privacidade.
3. Non rastrexamos a túa navegación… *(sin cambios)*

**Cookies §1 (es):** «1. Sin cookies ni rastreo», mismos cambios.

Aprobación del titular: _pendiente_

## CA-7 pendiente de campo (procedimiento)
1. Titular (H-1): Vercel → proyecto → Settings → Analytics → *Enable* Web Analytics. Después, fusionar y desplegar a producción (el script solo existe en el dominio tras activarlo y redesplegar).
2. Comprobar en producción que `/` pide `…/script.js` y una `…/view` del propio dominio (DevTools → Red, navegador normal).
3. Tras al menos un día con partidos, con un token de Vercel en local (nunca en el repo), una consulta por dimensión, `by=day`, entorno producción, guardando la respuesta cruda en `docs/epicas/EPIC-009-produccion-con-publico-capacidad-y-visitas-medidas/_qa/SPEC-077/visits-<dimensión>-<fecha>.json`:
   `MSYS_NO_PATHCONV=1 vercel api "/v1/query/web-analytics/visits/aggregate?environment=production&by=day&groupBy=<route|deviceType|country|referrerHostname>&from=<AAAA-MM-DD>&to=<AAAA-MM-DD>"` (o `curl -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/…&projectId=<id>&teamId=<id>"`; ajustar el nombre exacto del parámetro de agrupación a la documentación vigente y anotarlo).
4. Comprobar: las cuatro devuelven filas con `pageviews` y `visitors`; `route` incluye `/`, `/es` y `/xornada/[fecha]` (anotar el nombre real de ruta).
5. Esa misma tarde, una carga a mano con Playwright (p. ej. `npx playwright open https://marcador.gal/xornada/<sábado>` sin tocar `navigator.webdriver`), anotando hora UTC y ruta; al día siguiente, la consulta por `route` con `by=hour` (si la API lo admite) no muestra una vista extra en esa hora y ruta.
6. CA-5 de campo: `npm run primera:pintura -- --n 20` (perfil SPEC-026) contra producción; copiar aquí p75 de `/` y `/es` junto a la última medida de SPEC-026 y el veredicto (`cumple`).

## Cómo retomar (handoff)
- Hecho: CA-1, CA-2, CA-3, CA-4, CA-6 en código y tests; CA-5 en e2e y First Load JS (+1,7 kB gzip); CA-8 versión `0.6.0`, diff vigilado vacío. Commits en la rama: `081896a`, `9a795bc`, `2f808d4`, `d8adbf7`, `ad90a0c` y el de este ledger.
- Falta: G-4 (titular aprueba el texto de arriba antes del merge); H-1 y CA-7 de campo; CA-5 de campo (`primera:pintura` tras desplegar). Ambos con procedimiento arriba.
- Gates en Windows: lint y tests en worktree LF (`D:/src/tremen-dev/wt-077`, con junction de `node_modules`: quitarla con `cmd /c rmdir` antes de `git worktree remove`); build y e2e en el árbol principal.
