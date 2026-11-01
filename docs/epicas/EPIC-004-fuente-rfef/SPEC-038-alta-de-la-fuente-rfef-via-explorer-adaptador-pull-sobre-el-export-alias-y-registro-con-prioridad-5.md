---
id: SPEC-038
tipo: spec
epica: EPIC-004
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-01, por: Alberto Fojo}
---
# SPEC-038 — Alta de la fuente rfef vía explorer: adaptador pull sobre el export, alias y registro con prioridad 5

## Problema
La RFEF sigue sin entrar: la vía directa está agotada (SPEC-032) y el correo
sin respuesta (SPEC-036). ADR-023 decide consumir `marcadores.rfef.es` a
través de explorer, un servicio propio, por pull HTTP, con prioridad 5. Esta
spec da de alta la fuente `rfef`: adaptador sobre el export, alias de las
cinco competiciones, registro y primer tick en producción. No sube la
prioridad ni mide la jornada (SPEC-039).

## Usuarios / roles afectados
- Titular: despliega explorer (prerrequisitos de CA-9), pone los secretos y anota `legalBasis` (D-7).
- Espectador: donde API-Football no da directo, verá `live` `provisional` con el marcador de la RFEF.

## Criterios de aceptación
- **CA-1 Contrato con fixtures reales.** `ExplorerExport` (zod) en
  `src/sources/rfef/explorer.ts` valida el cuerpo de ADR-023 §4. Fixtures en
  `src/sources/rfef/fixtures/export/`: respuestas reales del endpoint desplegado
  (no de memoria ni de SQL), sin recortar, con README (URL sin token, `date`,
  `exportedAt`, procedencia). Como mínimo: un día con `LIVE_PROVISIONAL`,
  `FINISHED` y `SCHEDULED` de las cinco competiciones, más juvenil o femenino; un
  `POSTPONED` y un `SUSPENDED` si los hay (si no, filas reales mutadas, y el test
  lo dice); una fila con `discardedReadings > 0` si la hay. Campos desconocidos
  no rompen; `estado` fuera del enumerado, `lastSeenAt` no ISO o `matches` ausente
  → `requestErrors` con el motivo y **cero** observaciones de esa petición.
- **CA-2 Fetch.** Con `fetch` doble: (i) ventana vacía → 0 llamadas. (ii) Un GET
  por fecha Europe/Madrid distinta entre los kickoffs de `ctx.matches`
  (normalmente 1; un caso con dos fechas → 2), con `Authorization: Bearer
  <RFEF_EXPLORER_TOKEN>` y el `User-Agent` del contexto; `requests[i]` lleva
  `url` con `?date=`, `method: "GET"`, `status`, `contentType` y `body` igual al
  texto recibido; el token no aparece en `JSON.stringify(capture)`. (iii) Un
  no-2xx lanza (error del intento, ADR-003); un `200` con cuerpo vacío o no JSON
  **no** lanza: va al crudo y `parse` lo devuelve en `requestErrors`.
- **CA-3 Mapeo y relojes (ADR-023 §5).** Un caso por fila sobre filas reales:
  `SCHEDULED` → nada (ni `observations`, ni `skipped`, ni `unresolved`);
  `LIVE_PROVISIONAL` → `live` con `minute: null`, `addedMinute: null`, sin
  `halfTime`, y solo si `lastSeenAt ∈ [kickoff − 10, kickoff + 110)` con el
  kickoff declarado (bordes −11/−10 y +109/+110; fuera → `skipped:
  ambiguous_state`, reutilizando `state.ts`); `FINISHED` → `finished`;
  `POSTPONED` → `postponed`; `SUSPENDED` con marcador → `suspended`, sin él →
  `skipped: suspended_without_score`; `live`/`finished` sin un gol → `skipped:
  missing_score`. `observedAt` = `lastSeenAt` de la fila, nunca `exportedAt` ni
  `capturedAt`. Grupos fuera de `competitions` → ignorados sin rastro.
- **CA-4 Identidad (ADR-017 §2).** Mismo `normalizeName`, mapa `competitions` y
  resolución `(competición, local, visitante)` contra el calendario declarado
  que `adapter.ts` (un test compara los seis casos de SPEC-031 CA-6 en los dos
  adaptadores); `Number(jornada) ≠ round` → `inconsistent_alias`; equipo sin
  alias → `unknown_team` con `externalName` = nombre del export; par sin partido
  → `unknown_match`. `codEquipo*` y `codActa` no intervienen (quedan en el crudo).
- **CA-5 Alias completo.** `data/alias/2026-27/rfef.json` valida `AliasFile`,
  lleva los cinco `codgrupo` de `fixtures/alias-test.json` y cubre **todos** los
  `TeamId` de las cinco competiciones de `data/calendario/2026-27/` (test). Lo
  genera `npm run alias:rfef` desde los nombres federativos del calendario
  (normalizados) más las entradas ya validadas de `alias-test.json`, y con
  `--export <fichero>` lista los nombres del export que no resuelven; el ledger
  cita esa lista sobre el fixture de CA-1 y su corrección a mano (objetivo: 0
  sin resolver en los partidos de las cinco competiciones del fixture).
- **CA-6 Fuera de ventana.** El núcleo (`tick.ts`) descarta las observaciones
  cuyo `matchId` no está en la ventana de ese tick, las cuenta en
  `ingest_attempts.details.fueraDeVentana` y no ejecuta el motor por ellas.
  Test: export con un partido acabado por la mañana y uno en ventana → 1
  observación insertada, 1 contada. API-Football no cambia (0 contadas).
- **CA-7 Registro y motor.** `registry.ts` gana `rfef`: `pull`, las cinco
  competiciones con prioridad **5**, `minIntervalSeconds: 30`, el UA de
  `adapter.ts` (F-SPEC-032-4) y el `legalBasis` del titular (H-3).
  `ADAPTERS["rfef"]` construye el adaptador de explorer con el alias, el
  calendario de la temporada (cargador en `src/ingest/`, como `loadAliasFile`)
  y `RFEF_EXPLORER_URL`/`RFEF_EXPLORER_TOKEN` de env (el token entra en
  `REMOTE_SECRETS`). `adapter.ts` sigue sin registrar y sin cambios (`git
  diff`). `rfef-identity.test.ts` pasa a exigir la entrada. Tres casos sobre
  `decide` con las prioridades del registro: coinciden → `confirmado` citando
  ambas; discrepan con API-Football fresca → gana API-Football; API-Football
  callada 5 min → gana la rfef, `provisional`.
- **CA-8 Fallo visible, aislado.** Tick con las dos fuentes y un doble de
  explorer que responde 401, 500, vacío o JSON inválido: el intento `rfef` sale
  `ok = false` con el motivo, API-Football termina `ok = true`, `tick:salud`
  muestra la rfef en FALLO y la decisión vigente no cambia.
- **CA-9 Prerrequisitos externos (explorer), verificados antes del alta.** El
  ledger anota, con comando y salida sin secretos: (i) tablas en el esquema
  `explorer`, `public.matches` intacta (`\dt explorer.*`, `\dt public.*`); (ii)
  `explorer` fuera de los esquemas expuestos por la API y sin grants a `anon`,
  `authenticated` ni `web_reader`; (iii) el export responde `401` sin Bearer,
  `400` con fecha mala, `200` JSON con `Cache-Control: no-store`, y refleja
  Postgres (una fila cambiada por SQL aparece en la siguiente petición); (iv)
  un «Suspendido» real o inyectado sale `SUSPENDED`; (v) una lectura
  descartada incrementa `discardedReadings` y deja su `match_events`.
- **CA-10 Alta en producción.** Secretos en Vercel (producción); en una ventana
  con partidos de las cinco competiciones, `ingest_attempts` muestra intentos
  `rfef` `ok = true` cada ~30 s, ≥ 1 observación `sourceId = rfef`, objetos
  `raw/rfef/<fecha>/…` en Storage y `tick:salud` en verde. El ledger cita las
  consultas y una fila de ejemplo.
- **CA-11 Fronteras y gates.** `src/sources/rfef/` solo importa de `src/model`;
  el test de arquitectura de SPEC-031 CA-8 (sin `eval`, `new Function`,
  `node:vm`, `Date.now`, `new Date(`) cubre `explorer.ts`. Sin dependencias
  nuevas. `npm run gates` y `npm run e2e` → 0.

## Entidades y reglas afectadas
Source, SourceAdapter, Alias, Raw capture, Ventana, Tick (`dominio.md`); RN-01,
RN-03, RN-04, RN-08, RN-09, RN-10, RN-11; D-4, D-5, D-6, D-7, D-9; ADR-003,
ADR-004, ADR-007, ADR-008, ADR-011, ADR-013, ADR-017 §2-§4, **ADR-023**.

## Fuera de alcance
- Subir la prioridad, medir latencia, cobertura y acta cerrada: SPEC-039.
- Spec del motor de ADR-017 §8 (minuto prestado, `suspended` sin marcador).
- Push desde explorer (EPIC-005), lectura de `explorer.*` por SQL, cron de
  explorer, Playwright en Vercel y el propio código de explorer: fuera del
  repo, solo como prerrequisito verificable (CA-9).
- `codEquipo` y `codActa` como identidad (ADR-023 §Alternativas).

## Notas para el gate humano
- **H-1 Carpeta.** ADR-023 §6 pone el adaptador nuevo en `src/sources/rfef/explorer.ts` junto al directo, que queda intacto y en reserva. El orquestador recomendó carpeta nueva (`src/sources/rfef-explorer/`). ¿Misma carpeta (recomendado) o nueva? *Resuelta por el titular (Alberto Fojo, 2026-11-01):* misma carpeta.
- **H-2 Adaptador directo.** Queda **en reserva** (sin registrar; ADR-018/020/021 siguen rigiéndolo) por si la RFEF contesta (SPEC-036 vía 1). Alternativa: marcarlo no vigente y cerrar la vía directa. *Resuelta por el titular (2026-11-01):* en reserva.
- **H-3 `legalBasis`.** Texto del titular para el registro (D-7). Propuesta: «Datos de marcadores.rfef.es obtenidos por el servicio propio explorer con las reglas de acceso del titular (ADR-023 §2); correo a la RFEF del 2026-10-19 sin respuesta; gestión fuera del repo (D-7)». *Resuelta por el titular (2026-11-01):* el texto del registro es exactamente «Datos de rfef.es», nada más: no se dan pistas de cómo se obtienen. CA-7 usa ese texto.
- **H-4 Contrato.** Confirmar con explorer los añadidos de ADR-023 §4: `SUSPENDED` aparte, `discardedReadings` + registro del descarte, `no-store`, `200` nunca vacío, lectura de Postgres. POST solo como recomendación. *Resuelta (orquestador, 2026-11-01, como implementador de explorer):* confirmados todos; `SUSPENDED` ya separado en explorer (commit 9756194), el resto entra con el export.
- **H-5 `SCHEDULED` → nada** y el filtro de fuera de ventana en el núcleo (CA-6): tocan `tick.ts` para todas las fuentes, sin efecto en API-Football. *Resuelta por el titular (2026-11-01):* sí.
- **H-6 Orden.** CA-9 antes que CA-1 (los fixtures son del endpoint real) y CA-10 antes de SPEC-039. Propuesta: alta en la semana del 2026-11-03 y observación el fin de semana 2026-11-07/08. *Resuelta por el titular (2026-11-01):* sí; el despliegue de explorer en Vercel lo hace el titular.
