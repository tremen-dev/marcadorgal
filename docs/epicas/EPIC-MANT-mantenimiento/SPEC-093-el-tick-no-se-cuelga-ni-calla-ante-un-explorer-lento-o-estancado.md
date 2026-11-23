---
id: SPEC-093
tipo: spec
epica: EPIC-MANT
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-23, por: Alberto Fojo}
---
# SPEC-093 — El tick no se cuelga ni calla ante un explorer lento o estancado

## Problema
Con API-Football fuera (ADR-026), explorer es la única fuente del directo, y hay tres formas en que su fallo no se ve (trazado a `f363475`):
1. **Colgado.** `fetch` de `src/sources/rfef/explorer.ts` no tiene plazo, y undici espera hasta 300 s. La ruta tiene `maxDuration = 60`: Vercel mata la función, el intento se queda sin `closeAttempt` y en ese tick no hay barrido (RN-05, RN-02) ni envío social, porque `runTick` los hace después de los intentos. `tick:salud` lo pinta como `abierto` y sigue en verde.
2. **Estancado.** `observedAt = lastSeenAt` (ADR-023 §5). Si explorer responde pero deja de releer filas, RN-01 descarta lo viejo (> 5 min) y a los 15 min RN-05 marca `sen_sinal`, mientras el intento queda `ok = true` y salud en verde. Así, el fallo de la fuente parece silencio del partido.
3. **Respaldo mudo.** `src/lib/explorer-client.ts` y `src/sources/rfef/calendar.ts` caen a la URL `https://marcadorgal-explorer.vercel.app` y a un token `""` sin avisar, con cinco nombres de variable (`EXPLORER_BASE_URL`, `EXPLORER_API_KEY`, `EXPLORER_TOKEN` además de los dos canónicos). El tick (`src/ingest/adapters.ts`) sí exige `RFEF_EXPLORER_URL` y `RFEF_EXPLORER_TOKEN`.

## Usuarios / roles afectados
Titular: salud e informe de jornada. Público, de forma indirecta: barrido y tuits a tiempo.

## Criterios de aceptación
Vitest, con fixtures de `src/sources/rfef/fixtures/export/`, `fetch` falso y la BD de memoria de `src/ingest/memory.ts`. Nunca contra la red. El plazo se inyecta en los tests (ms), no se espera de verdad.
- **CA-1 (plazo del intento)**: Dada una fuente pull cuyo `fetch` no termina (ni las cabeceras ni el cuerpo) en `SOURCE_ATTEMPT_TIMEOUT_MS` (10 000 por defecto, en `src/ingest/constants.ts`), cuando corre `runTick`, entonces la petición se aborta, el intento se cierra con `ok = false` y un `error` que nombra la fuente y el plazo, y después corren el barrido y el envío social (`summary.engine` y `summary.social` presentes). El plazo cubre todo el `fetch` del intento: con dos fechas, son 10 s en total, no por petición. El adaptador no lee el reloj: el plazo lo pone el núcleo en el `fetch` que le pasa.
- **CA-2 (salud ve el intento huérfano)**: Dado un intento con `finished_at` nulo y `startedAt` anterior a `now − 2 min` (`SALUD_ORPHAN_MINUTES`, mayor que `maxDuration`), cuando se calcula `tickSalud`, entonces sale `REVISAR`, la fila dice `sin cerrar` y la razón lo nombra. Un intento abierto más reciente sigue siendo `abierto` y no pone el semáforo en rojo (el caso normal, SPEC-010 CA-1).
- **CA-3 (lecturas de la fuente)**: Dado un export de fixture, cuando `parse` lo interpreta, entonces el resultado lleva, por cada fila resuelta contra el calendario declarado, el par `{matchId, readAt = lastSeenAt}`, sea cual sea su `estado` (incluidas `SCHEDULED` y las `skipped`). Es un campo opcional nuevo de `ParseResult` en `src/model`. `observations` no cambia.
- **CA-4 (fuente estancada)**: Dado un intento con al menos un partido de su ventana (sin contar el de recuperación) cuyo `kickoff ≤ now` y cuyo estado actual sea `scheduled` o `live`, y con lecturas de esos partidos, cuando la más reciente tiene más de `OBSERVATION_WINDOW_MINUTES` (`src/decide/thresholds.ts`), entonces el intento se cierra con `ok = false` y el error `rfef: fuente estancada: última lectura hace N min`. Las observaciones se insertan igual y el motor decide igual (como `requestErrors`, N-2), y `tick:salud` sale `REVISAR`. Con la lectura más reciente dentro de los 5 min, `ok = true`. En ambos casos `details` lleva `ultimaLectura` y `edadLecturaMin`. Si no hay partidos empezados sin cerrar, no hay ni veredicto ni campos.
- **CA-5 (sin respaldo mudo)**: Sin `RFEF_EXPLORER_URL`, o sin `RFEF_EXPLORER_TOKEN`, `fetchExplorer`, `getDayMatchesRaw` y `fetch` del calendario `rfef` (competiciones no declaradas) lanzan un error que nombra la variable y no llaman a `fetch`. Tercera, que va por fichero, sigue sin red (SPEC-090 CA-1). Un test recorre el código de `src/` y `tools/` (`.ts`, `.tsx`, `.mjs`; ni tests ni el README de fixtures, que documenta la procedencia) y verifica que ninguno contiene `marcadorgal-explorer.vercel.app`, `EXPLORER_BASE_URL`, `EXPLORER_API_KEY` ni `EXPLORER_TOKEN` fuera del nombre `RFEF_EXPLORER_TOKEN`.
- **CA-6 (registro veraz)**: El comentario de `src/sources/registry.ts` deja de nombrar API-Football y su prioridad 10. Dice que `rfef` es la única fuente registrada (ADR-026), que RN-04 no puede dispararse con una sola fuente y que el arbitraje entre proveedores vive en explorer (`liveProvider`, SPEC-049). Se verifica en el ledger con `rg -n "API-Football" src/sources/registry.ts`, que no debe dar ninguna línea.

## Entidades y reglas afectadas
RN-01, RN-02, RN-05 y RN-11 (sin cambios: `src/decide` no se toca), RN-04 (dormida mientras haya una sola fuente). D-9: la fuente estancada se reporta en `ingest_attempts`, nunca como estado del partido. ADR-003 (el fallo es del intento), ADR-023 §4-§5, ADR-026, SPEC-010 CA-1, SPEC-029 CA-1 (el lock es de transacción: un intento huérfano no bloquea el siguiente), SPEC-090. ADR-028: `patch`.

## Fuera de alcance
- Plazos de Storage (`storeCapture`) y de Postgres dentro del tick. Si cuelgan, CA-2 los hace visibles. El envío social ya tiene plazo (`BUFFER_TIMEOUT_MS`).
- Un partido concreto que explorer deja de leer mientras lee los demás: es silencio de ese partido y lo cubre RN-05.
- Una fila que no viene en el export: la cubren RN-05 y `unresolved`.
- Cambios en explorer, en el motor o en el semáforo del informe de jornada (que ya explica cada `ok = false`, SPEC-009 CA-7).
- Un ADR para el plazo: es una cifra reversible del núcleo, no una frontera. Va justificada aquí y en el comentario de la constante.

## Notas para el gate humano
1. **Por qué 10 s.** El export responde en cientos de ms (comentario de `EXPLORER_ENRICHMENT_TIMEOUT_MS`) y un arranque en frío de explorer en Vercel, en segundos: 10 s deja más de 3× de margen. Con dos temporadas a la vez (solo en el cambio de temporada) son 20 s de peor caso, por debajo de la cadencia de 30 s y lejos de los 60 de `maxDuration`, así que el barrido y el envío social siempre llegan. Los 2 s del enriquecimiento no sirven aquí: un corte en falso cuesta un intento entero, no unos goleadores.
2. **Rojo en los cooldowns de explorer (6/11/17 min, ADR-023).** CA-4 pondrá salud en rojo durante esos cooldowns, y es lo que se busca: en ese rato RN-01 ya está descartando sus lecturas.
3. **H-1 (CA-5) — aliases: cerrada (titular, 2026-11-23).** Se retiran `EXPLORER_API_KEY` y el resto de alias, y ADR-026 §1 lleva la nota fechada, sin ADR nuevo. `vercel env ls` (2026-11-23): Production tiene `RFEF_EXPLORER_URL` y `RFEF_EXPLORER_TOKEN`, y ningún entorno usa alias. **Despliegue:** Preview no tiene ninguna de las dos, así que con CA-5 sus peticiones a explorer fallarán con un error explícito; hoy ya fallaban, en silencio, con la URL fija y un token vacío. Si se añaden a Preview lo decide el titular, y no bloquea la fusión.
