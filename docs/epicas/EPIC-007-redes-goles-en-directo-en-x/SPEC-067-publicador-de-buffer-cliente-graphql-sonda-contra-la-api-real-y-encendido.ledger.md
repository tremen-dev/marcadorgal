---
id: SPEC-067
tipo: ledger
epica: EPIC-007
---
# Ledger — SPEC-067 Publicador de Buffer: cliente GraphQL, sonda contra la API real y encendido

## Resumen
- Fase: en-revision (implementación terminada el 2026-11-10; CA-6 y CA-7 son del titular y quedan pendientes)
- Rama: `ft/SPEC-067-publicador-de-buffer`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `tools/social-probar.mjs` (shell), `src/social/buffer/probe.ts` (`runProbe`: `--limites`, `--canales`, `--publicar [--modo]`, `--post`, `--tipo`, `--guardar`), `src/social/buffer/client.ts` (`bufferRequest`, `redactSecret`), `src/social/buffer/queries.ts`, `package.json` (`social:probar`), `biome.json` (fixtures excluidas del formateador) | `src/social/buffer/probe.test.ts` (9: sin variables sale 1 y las nombra; sin opción sale 1 con el uso; `--limites` pide `dailyPostingLimits` del canal e imprime HTTP/cuerpo/ms; `--publicar` envía `text`, `channelId`, `schedulingType: automatic`, modo y los campos obligatorios vacíos; `--post`; `--guardar` escribe la fixture con `requestedAt`; clave centinela ausente de salida y fixture y canal `<CHANNEL>`; error de red y 401 impresos, salida 1); `src/social/buffer/client.test.ts` (6: POST con bearer y JSON, respuesta cruda, no-2xx cruda, abort por timeout, error de red, `redactSecret`) | 2026-11-10 verificador: `npm run social:probar -- --limites` → HTTP 200 en 464 ms, `limit 100`, `sent 6`, canal `<CHANNEL>`; `-- --canales` → «marcadorgal» y «* minhaproba <- BUFFER_CHANNEL_ID del entorno»; la clave (completa, prefijo 10) y el id del canal no aparecen en ninguna de las dos salidas (comprobado por script contra `.env.local`). Sin variables (cwd sin `.env.local`) → «Faltan variables: BUFFER_API_KEY, BUFFER_CHANNEL_ID», exit 1; sin opción → uso, exit 1. Mismo transporte que producción (`bufferRequest`). Tests de sonda y cliente verdes | ✅ |
| CA-2 | Manual contra la API real, 2026-11-10 17:15-17:17 UTC, canal de pruebas «minhaproba». Fixtures en `src/social/buffer/fixtures/` (17, crudas, clave `<KEY>` y canal `<CHANNEL>` redactados). Datos en «Evidencia de CA-2» | n-a (manual); las fixtures alimentan los tests de CA-3 | 2026-11-10 verificador, recalculado desde las fixtures: (a) `create-post-share-now*.json` → `PostActionSuccess`, `status sent`, `mode shareNow`; (b) `sentAt − requestedAt` = 1,415 / 1,471 / 1,537 / 1,395 s (posts 2-5; el 1 sin `requestedAt`, ≤ 2,18 s desde el texto) → mediana 1,47 s, máx 2,18 s ≤ 30 s; (c) `limites.json` `limit 100`; (d) `create-post-duplicate-1/2.json`: mismo texto, 5,98 s de separación, 2.º → `InvalidInputError` «same thing twice»; (e) `create-post-clave-invalida.json` HTTP 401 «Access token is not valid»; (f) `ms` máximo de `createPost` = 1696 ≤ 2500. Todas las `createPost` llevan `channelId <CHANNEL>` (= canal del `.env.local`, «minhaproba»). `<KEY>`/`<CHANNEL>` en las fixtures; 0 coincidencias de clave o canal en `src/`, `tools/`, `docs/`, `biome.json`, `package.json` y `git log -p origin/main..HEAD` | ✅ |
| CA-3 | `src/social/buffer/publisher.ts` (`createBufferPublisher`, `BUFFER_MODE = "shareNow"`, `mapCreatePost` con zod), `src/social/buffer/client.ts` (timeout 5 s de ADR-030 §4 vía `AbortSignal.timeout`) | `src/social/buffer/publisher.test.ts` (19, sobre fixtures: `id` `buffer` y variables de `createPost`; `PostActionSuccess` → `sent` con `post.id`; `InvalidInputError` del duplicado → `rejected` con el mensaje en una línea; 401 de `create-post-clave-invalida` → `rejected` «HTTP 401: Access token is not valid»; 403/400/404 → `rejected`; 429 → `retry` con y sin `Retry-After`; 500/502/503/504 → `retry`; 200 con HTML o sin `createPost` → `unknown`; 200 con `errors` → `rejected`; error de red y abort → `unknown`; ningún resultado lleva la clave aunque el proveedor la devuelva) | 2026-11-10 verificador: código leído (`publisher.ts`, `client.ts`, `queries.ts`): `POST https://api.buffer.com`, `authorization: Bearer`, `schedulingType automatic`, `mode shareNow`, `AbortSignal.timeout(5000)`; mapeo 429→retry (+Retry-After), ≥500→retry, otros no-2xx→rejected, 2xx `PostActionSuccess`→sent, `MutationError`→rejected (discriminado por forma), JSON inesperado / sin `createPost` / abort / red→unknown; `redactSecret` + una línea en cada `reason`. `fetch` inyectado en todos los tests; 19 tests verdes sobre fixtures reales | ✅ |
| CA-4 | `src/social/publisher.ts` (`PUBLISHERS.buffer`, `PublisherFactory` devuelve `null` sin clave o canal), `src/app/social.ts` (`createSocialDispatch(env, db, now, {fetch})`: seco + `error: "unconfigured"`), `src/ingest/tick.ts` (`SocialOutcome = {counts, error?}`; `runTick` vuelca `error` en `socialError`), `src/app/api/ingest/tick/route.ts` (pasa `fetch`), `.env.example` | `src/social/publisher.test.ts` «SPEC-067 CA-4» (6: registro = `["buffer"]`; con clave y canal → publicador `buffer`; tabla sin clave / clave vacía / sin canal / canal vacío → `null`); `src/app/social.test.ts` «SPEC-067 CA-4» (6: con clave y canal el despacho llama a Buffer por el `fetch` inyectado y la fila queda `sent`/`buffer`/`provider_post_id`; tabla sin clave / sin canal / ambos vacíos → fila `skipped/disabled` con texto, `{counts, error: "unconfigured"}`, 0 peticiones, nada lanza; sin `SOCIAL_PUBLISHER` → sin error); `src/social/config.test.ts` (registro real: `buffer` sí, `memory` no; `.env.example` documenta `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID` y «Production»); `src/ingest/tick.test.ts` «SPEC-066 CA-11» (hook devuelve `{counts}`; nuevo caso: `{counts, error}` → `social` + `socialError`) | 2026-11-10 verificador: `PUBLISHERS.buffer` devuelve `null` sin clave o canal; `socialConfig` solo admite ids del registro (id desconocido o ausente → `null`, sin `unconfigured`, sin lanzar); `createSocialDispatch` marca `unconfigured` solo con factory presente y publicador `null`; `runTick` lo vuelca en `socialError` y conserva `social`. `.env.example` con ambas variables y «solo en Production». Tests de tabla verdes (`publisher.test.ts`, `app/social.test.ts`, `config.test.ts`, `tick.test.ts`). No se ejecutó un `POST /api/ingest/tick` real con `buffer` (F-SPEC-067-5, es CA-7) | ✅ |
| CA-5 | `src/social/buffer/publisher.ts` (un `bufferRequest` por `publish`, sin consultas), `src/social/dispatch.ts` sin cambios (una llamada por fila reclamada, SPEC-066 CA-5) | `src/app/social.test.ts` «CA-5: three rows are three createPost and nothing else» (3 filas → 3 peticiones, todas `mutation CreatePost`, ninguna `dailyPostingLimits` ni `query Post`); `src/social/buffer/publisher.test.ts` (cada `publish` = exactamente 1 `fetch`) | 2026-11-10 verificador: `publish` hace un único `bufferRequest` (`CREATE_POST`); `POST` y `DAILY_POSTING_LIMITS` solo se importan en `probe.ts`; `dispatch.ts` sin cambios respecto a `origin/main`. Test «three rows are three createPost» verde | ✅ |
| CA-6 | Pendiente: ensayo en seco en la próxima jornada con SPEC-066 desplegada (#115) y `SOCIAL_PUBLISHER` sin fijar. Consulta y criterio en «CA-6: ensayo en seco» | n-a (manual, del titular) | 2026-11-10 verificador: no verificable hoy (requiere una jornada con SPEC-066 en prod). La sección «CA-6: ensayo en seco» trae consulta y criterio; el titular pega el resultado aquí | ⚠️ pendiente titular |
| CA-7 | Pendiente: del titular (H-1, H-3, H-4). Checklist en «CA-7: encendido» | n-a (manual, del titular) | 2026-11-10 verificador: no ejecutado ni tocado Vercel (por encargo). Checklist de 8 pasos en «CA-7: encendido»; la evidencia (primera fila `sent` + URL del tweet, simulacro de apagado) la pega el titular. Requiere CA-2 (✅) y CA-6 cerrados | ⚠️ pendiente titular |
| CA-8 | `package.json` 0.5.8 → 0.6.0 (`chore(release): 0.6.0`); `src/social/buffer/` dentro de la frontera | `src/arch/social-boundary.test.ts` verde con `src/social/buffer/`; `node tools/version-gate.mjs --base origin/main` → «ok — 0.5.8 → 0.6.0, package-lock.json coherente»; gates en «Evidencia del implementador» | 2026-11-10 verificador (Windows 11, Node 24): `npm run typecheck` ✅ · `npm run lint` ✅ (457 ficheros) · `npx vitest run` 161/162 ficheros, 2673 pasan, 1 falla preexistente (`src/db/test-db.test.ts › wins over a .env file in the cwd too`, Windows) · `npm run build` ✅ («Compiled successfully», `/api/ingest/tick`) · `node tools/version-gate.mjs --base origin/main` → ok 0.5.8 → 0.6.0 (`minor`, feat) · `src/arch/social-boundary.test.ts` verde | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN** — 2026-11-10, sdd-verificador. CA-1, CA-2, CA-3, CA-4, CA-5 y CA-8 verificados sobre artefactos y ejecución (sonda real contra Buffer con `--limites` y `--canales`, fixtures recalculadas, suites y gates corridos en esta máquina). CA-6 y CA-7 quedan ⚠️ pendientes del titular por naturaleza (jornada real y encendido en Vercel): la spec pasa a `hecho` con ese residual, y el encendido no debe ocurrir hasta cerrar CA-6 con la consulta del ledger. Secretos: 0 coincidencias de la clave y del canal fuera de `.env.local`. Sin posts de prueba adicionales durante la verificación (`sent` sigue en 6 en «minhaproba»). Observaciones no bloqueantes: `LimitReachedError` (posible `PostActionPayload`) se mapea a `rejected` sin reintento, como pide CA-3, pero conviene tenerlo presente con H-5; las fixtures guardan la cabecera `set-cookie` `AWSALBTGCORS` (cookie de afinidad del balanceador, no credencial) y `post-by-id.json` lleva el id numérico de X de la cuenta de pruebas en `externalLink`; `create-post-share-now.json` no tiene `requestedAt` (capturada antes de añadir el campo).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-067/. Informe HTML opcional: _qa/SPEC-067/informe.html -->
n-a: sin UI. La evidencia es textual (salidas de la sonda y fixtures).

## Evidencia de CA-2 (2026-11-10, sdd-implementador, Windows, Node 24, `.env.local` con la clave del titular)
Canal del entorno comprobado antes de publicar: `npm run social:probar -- --canales` → dos canales `twitter`, «marcadorgal» y «minhaproba»; el marcado `* ... <- BUFFER_CHANNEL_ID del entorno` es «minhaproba». Nada se publicó en «marcadorgal».

- **(a) Modo.** `createPost` acepta `mode: shareNow` con `schedulingType: automatic` (`fixtures/create-post-share-now.json`): `PostActionSuccess` con `post.status: "sent"`, `sentAt` y `externalLink` ya en la respuesta. `customScheduled` y `addToQueue` no se probaron (no hacían falta). Enum `ShareMode` = `addToQueue | customScheduled | shareNext | shareNow` (`fixtures/tipo-share-mode.json`); `CreatePostInput` exige además `needsApproval: false`, `tagIds: []`, `assets: []` (`fixtures/tipo-create-post-input.json`).
- **(b) Latencia, 5 posts `shareNow`** («Proba marcador.gal n/5 <hora>»). Segundos desde la petición hasta `sentAt` de Buffer y hasta la hora real del tweet en X (del id Snowflake de `externalLink`, `(id >> 22) + 1288834974657`):

  | Post | Petición (UTC) | Respuesta | `sentAt` − petición | hora X − petición | Fixture |
  |---|---|---|---|---|---|
  | 1/5 | 17:15:17 (precisión de segundo) | 1417 ms | ≤ 2,18 s | ≤ 2,02 s | `create-post-share-now.json` |
  | 2/5 | 17:15:55.709 | 1464 ms | 1,415 s | 1,271 s | `create-post-share-now-2.json` |
  | 3/5 | 17:16:00.470 | 1458 ms | 1,471 s | 1,279 s | `create-post-share-now-3.json` |
  | 4/5 | 17:16:05.213 | 1467 ms | 1,537 s | 1,294 s | `create-post-share-now-4.json` |
  | 5/5 | 17:16:09.960 | 1466 ms | 1,395 s | 1,258 s | `create-post-share-now-5.json` |

  **Mediana 1,47 s, máximo 2,18 s** (criterio de parada: mediana ≤ 30 s, cumplido). Los tweets: `https://x.com/minhaproba/status/2120203661427036480`, `…2120203820642734474`, `…2120203840645472500`, `…2120203860601868538`, `…2120203880361246860` (cuenta protegida: solo los ve el titular).
- **(c) Tope diario.** `dailyPostingLimits` del canal: `limit: 100`, `isAtLimit: false` (`fixtures/limites.json`); tras las pruebas `sent: 6`.
- **(d) Duplicado exacto.** Primer envío → `PostActionSuccess`/`sent` (`create-post-duplicate-1.json`); el mismo texto 6 s después → HTTP 200 con `__typename: "InvalidInputError"` (implementa `MutationError`): «Invalid post: Whoops, it looks like you've already got this one scheduled or posted around the same time. We're not able to post the same thing twice so close together.» (`create-post-duplicate-2.json`). En X aparece una sola vez. El cliente lo mapea a `rejected`.
- **(e) Clave inválida.** `BUFFER_API_KEY=invalid-key-0000 npm run social:probar -- --publicar …` → HTTP 401, `{"errors":[{"message":"Access token is not valid","extensions":{"code":"UNAUTHENTICATED"}}]}` (`create-post-clave-invalida.json`, `limites-clave-invalida.json`). Mapeo: `rejected` «HTTP 401: Access token is not valid».
- **(f) Respuesta más lenta de `createPost`: 1696 ms** (duplicado 1); de los 5 medidos, 1467 ms. Umbral de parada 2,5 s: cumplido. Las consultas (`--limites`, `--post`, `--tipo`) tardan 270-550 ms.
- Secretos: `grep` del prefijo de la clave y del id del canal sobre `src/social/buffer/` y `docs/`: 0 coincidencias. `MutationError` es una interfaz; `PostActionPayload` es una unión con `PostActionSuccess` y los errores (`tipo-post-action-payload.json`, `tipo-mutation-error.json`).

## CA-6: ensayo en seco (pendiente, titular, próxima jornada)
Con SPEC-066 desplegada y `SOCIAL_PUBLISHER` sin fijar en Vercel (hoy), tras la jornada, contra prod (`psql "$DATABASE_URL"` o el editor SQL de Supabase):

```sql
-- Goles esperados: subidas de marcador entre Decisions live consecutivas,
-- confirmadas, de equipos vigilados (ids de data/galegos/2026-27.json).
with vigilados as (select unnest(array['<id1>','<id2>', '...']) as team_id),
d as (
  select d.id, d.match_id, d.version, d.home_score, d.away_score, d.qualifier, d.decided_at,
         lag(d.status) over w as prev_status, lag(d.home_score) over w as prev_home, lag(d.away_score) over w as prev_away
  from decisions d
  where d.decided_at >= '<inicio jornada>' and d.decided_at < '<fin jornada>'
  window w as (partition by d.match_id order by d.version)
),
esperados as (
  select d.id as decision_id, d.match_id, s.side
  from d
  join matches m on m.id = d.match_id
  cross join lateral (values ('home', m.home_team_id, d.home_score, d.prev_home), ('away', m.away_team_id, d.away_score, d.prev_away)) as s(side, team_id, score, prev)
  where d.prev_status = 'live' and d.qualifier = 'confirmado' and s.score > s.prev
    and s.team_id in (select team_id from vigilados)
)
select e.decision_id, e.match_id, e.side, p.id as post_id, p.status, p.reason, p.template_id, p.text
from esperados e
left join social_posts p on p.decision_id = e.decision_id and p.side = e.side and p.kind = 'goal'
order by e.match_id, e.decision_id;
-- Criterio: ninguna fila con post_id null; todas skipped/disabled con texto.
select decision_id, side, count(*) from social_posts group by 1, 2 having count(*) > 1;  -- debe devolver 0 filas
```
Visto bueno del titular a los textos (`text`) de esa jornada (SPEC-066 H-5). Pegar aquí el resultado (filas, sin secretos).

## CA-7: encendido (pendiente, titular; con CA-2 y CA-6 cerrados)
1. H-3: la cuenta de X «marcadorgal» con etiqueta «Automated» y bio que dice quién la opera.
2. Id del canal real: `npm run social:probar -- --canales` lista «marcadorgal» con su `id` sin redactar (solo se redacta el del `.env.local`). No cambies `BUFFER_CHANNEL_ID` del `.env.local`: el local sigue apuntando a «minhaproba».
3. Solo Production (`vercel env add <NOMBRE> production`, pegando el valor al prompt): `SOCIAL_PUBLISHER=buffer`, `BUFFER_API_KEY=<clave>`, `BUFFER_CHANNEL_ID=<id de marcadorgal>`; opcionales `SOCIAL_WATCHED_TEAMS` (vacía = `data/galegos/2026-27.json`) y `SOCIAL_LINK_URL=https://marcador.gal`.
4. `vercel env ls` → las tres variables solo en `Production`. Redeploy del commit vigente (`vercel redeploy <url de prod>` o desde el panel).
5. Evidencia: primera fila `sent`: `select id, decision_id, side, provider, provider_post_id, text, closed_at from social_posts where status = 'sent' order by closed_at limit 1;` + URL del tweet (`npm run social:probar -- --post <provider_post_id>` imprime `externalLink`; `--post` no depende del canal del `.env.local`).
6. Simulacro de apagado: `vercel env rm SOCIAL_PUBLISHER production`, redeploy; siguiente fila vigilada → `status = 'skipped'`, `reason = 'disabled'`. Volver a añadirla y redeploy.
7. Corte inmediato sin redeploy: pausar o desconectar el canal en Buffer.
8. Con `SOCIAL_PUBLISHER=buffer` pero sin alguno de los dos secretos, el resumen del tick lleva `socialError: "unconfigured"` y las filas quedan `skipped/disabled` (CA-4).

## Evidencia del implementador (2026-11-10, Windows 11, Node 24)
- `npm run typecheck` ✅ · `npm run lint` ✅ (457 ficheros) · `npx vitest run`: 162 ficheros, **2673 pasan, 1 falla preexistente** (`src/db/test-db.test.ts › wins over a .env file in the cwd too`, solo Windows, F-SPEC-066-1), 3 omitidos · `npm run build` ✅ (`✓ Compiled successfully`, `/api/ingest/tick`).
- `src/social/buffer/`: 34 tests; `src/app/social.test.ts` 9; `src/social/publisher.test.ts` 11; `src/arch/social-boundary.test.ts` verde.
- `node tools/version-gate.mjs --base origin/main` → ok 0.5.8 → 0.6.0.
- `test:db` no se corrió: la spec no toca SQL ni `src/social/db.ts`.

## Salvedades / follow-ups
<!-- IDs F-SPEC-067-1, F-SPEC-067-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-067-1** (SPEC-067 CA-4, contrato): el hook `SocialDispatch` de `src/ingest/tick.ts` pasa de devolver `SocialCounts` a `{counts, error?}` para que `unconfigured` llegue al resumen sin perder los contadores. Tests de SPEC-066 CA-11 adaptados (`tick.test.ts`, `app/social.test.ts`); `route.test.ts` no cambia.
- **F-SPEC-067-2** (verificador/titular): `UnexpectedError` y `RestProxyError` de Buffer (implementan `MutationError`) se mapean a `rejected` como pide CA-3, sin reintento; si en la jornada medida aparecen, valorar moverlos a `retry` en una spec de mejora.
- **F-SPEC-067-3** (titular, CA-2 b): la «hora del tweet en X» se derivó del id Snowflake del tweet; coincide con `sentAt` de Buffer ± 0,2 s. No se comprobó a ojo en la cuenta protegida.
- **F-SPEC-067-4** (EPIC-MANT): `node tools/social-probar.mjs` avisa `MODULE_TYPELESS_PACKAGE_JSON` al importar `.ts` (igual que los demás `tools/*.mjs` con Node 24); inocuo.
- **F-SPEC-067-5** (verificador): CA-4 «el despacho usa el cliente» se prueba con `fetch` inyectado y la base en memoria; no se ejecutó `POST /api/ingest/tick` real con `SOCIAL_PUBLISHER=buffer` (eso es CA-7, del titular, contra la cuenta real).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Rama `ft/SPEC-067-publicador-de-buffer` sobre `origin/main` 7f881b4 (0.5.8), commits: docs aprobada, en progreso, CA-1, CA-3, fix CA-3, CA-4/5, `chore(release): 0.6.0`, ledger. Sin push ni PR.
- Hecho: CA-1, CA-2, CA-3, CA-4, CA-5, CA-8. Pendientes del titular: CA-6 (consulta arriba, próxima jornada) y CA-7 (checklist arriba). No se tocó Vercel ni `SOCIAL_PUBLISHER`.
- Para reproducir CA-2: `npm run social:probar -- --canales` (comprobar el `*`), `-- --limites --guardar limites`, `-- --publicar "Proba …" --guardar <nombre>`. El canal del `.env.local` es «minhaproba».
