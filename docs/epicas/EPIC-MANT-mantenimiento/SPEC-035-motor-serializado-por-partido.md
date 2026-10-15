---
id: SPEC-035
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-15, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-15, por: sdd-implementador}
---
# SPEC-035 — Motor serializado por partido

## Problema
M-9 de EPIC-MANT, medido en `_qa/investigacion-2026-10-15/INFORME.md` §1.
pg_cron y Vercel Cron disparan el tick a 1-4 s. El lock de `openAttempt`
(ADR-008 §3) deja un solo `fetch`, pero el otro tick corre su barrido
(`src/ingest/tick.ts:163-169`). `decideMatches` (`src/ingest/engine.ts:247-262`)
lee `currents` sin serializar: las dos transacciones ven la misma vigente, la
idempotencia por tupla (ADR-009 §2, `src/decide/engine.ts:252`) no frena y
`assign_decision_version` (max+1) da dos versiones. Del 22-09 al 12-10: 36
gemelas en 23 partidos, 4 con `decided_at` invertido, 0 con contenido
distinto, 0 23505. Hoy no se ve (`board_delta` deshabilitado). Latente: (a)
barrido rancio que publica una versión mayor con el marcador viejo (RN-03 no lo
frena); (b) 23505 que deshace el `afterInsert` y sus Observations; (c)
emisiones dobles o desordenadas con Realtime.

## Usuarios / roles afectados
Público (marcador correcto con Realtime). Titular (informe de jornada).

## Criterios de aceptación
- **CA-1 Cerrojo por partido antes de leer.** `decideMatches` sustituye su
  primera consulta por `select … from matches where id = any(…) order by id
  for no key update` (ADR-019 §1), antes de `currents`, `observations` y `lastHeard`.
  Test (`engine.db.test.ts` «SPEC-035 CA-1»): fuente sembrada, tx A corre
  `decideMatches([m])` y queda abierta; tx B corre lo mismo y no termina
  mientras A siga abierta; al confirmar A, B devuelve `decisions: 0`. Hay una
  sola fila nueva en `decisions` y ningún 23505. En rojo sin el arreglo.
- **CA-2 Sin rancio (daño a).** A inserta una Observation de gol y corre
  `decideMatches` sin confirmar. B (barrido, `now` posterior) espera. Al
  confirmar A, la mayor `version` lleva el marcador del gol y B no escribe una
  versión con el marcador viejo. Test «SPEC-035 CA-2».
- **CA-3 Sin interbloqueo ni freno a la ingesta.** Hay dos casos. A inserta
  Observations de `m2` y corre `decideMatches([m2])`, mientras B corre
  `decideMatches([m1,m2,m3])`: los dos confirman y no hay 40P01. Con A
  reteniendo el cerrojo de `m1`, un `insertObservations` de `m1` en otra
  transacción termina sin esperar a A. Test «SPEC-035 CA-3».
- **CA-4 El resto, igual.** Los `engine*.test.ts`, `reconciliacion*.db.test.ts`
  y `tick.test.ts` pasan sin cambiar ninguna aserción. El replay de jornada da
  las mismas Decisions.
- **CA-5 Detección en el informe (ADR-019 §4).** `informe:jornada` añade
  «Decisiones gemelas: N» (tupla de ADR-009 §2 igual a la versión anterior) y «`decided_at`
  invertido: N», y lista los partidos si N > 0. Test `informe.test.ts`
  «SPEC-035 CA-5»: el fixture con un par gemelo da 1 y el limpio da 0. Verif.:
  en la primera jornada tras desplegar, las dos líneas dan 0.
- **CA-6 Fronteras y gates.** Bajo `src/`, solo `ingest/engine.ts`,
  `ingest/informe*.ts` y sus tests. `git diff main -- src/decide src/model
  src/sources supabase/migrations` vacío. Sin grants ni dependencias nuevas.
  `npm run gates` → 0 y `npm run test:db` en verde. Nada contra producción.

## Entidades y reglas afectadas
Decision, Tick (`dominio.md`). RN-03, RN-05, RN-07 (`reglas.md`). ADR-006 §3,
ADR-008 §3 y §7, ADR-009 §1, §2 y §6, **ADR-019**, ADR-015 §1, ADR-016.
SPEC-024 N-1.

## Fuera de alcance
- Blindar el lock de `openAttempt` frente a `web_reader` (ADR-015 §1, H-4).
  Es otro problema y está cerrado por SPEC-029 CA-1.
- Borrar o corregir las 36 gemelas: Decisions append-only (RN-07).
- Cambiar `decided_at` o `src/decide/` (ADR-019 §3). Encender `board_delta`.

## Notas para el gate humano
- **H-1 Mecanismo.** (A) `for no key update` sobre `matches`: no choca con el
  `key share` de las FK de `observations`/`decisions`, así que no frena la
  ingesta ni interbloquea con el `afterInsert`. `web_reader` no puede tomarlo
  porque no tiene privilegios sobre `matches`. (B) `for update`: choca con esas
  FK y el hook interbloquearía con el barrido (CA-3). (C)
  `pg_advisory_xact_lock(hashtext('decide:'||id))`: `web_reader` podría
  retenerlo y congelar el motor, es el residuo de ADR-015 §1. (D) «No barrer si
  la cadencia saltó el intento»: RN-05 y el cierre forzoso quedarían a merced
  del otro disparador, y no cubre dos `afterInsert` de fuentes distintas
  (RFEF). **Recomendado: A.**
- **H-2 `decided_at` sigue siendo el `now` del tick** (ADR-008 §7). Serializar
  quita las gemelas, pero un tick con `now` anterior que confirma después puede
  escribir una versión distinta con `decided_at` menor. El orden lo dan
  `version` y `recorded_at` (ADR-016). Cambiarlo toca `src/decide`.
  **Recomendado: aceptarlo** (ADR-019 §3).
- **H-3 Detección.** En `informe:jornada` (CA-5) y no en `tick:salud`, que
  mira 10 min y no ve pares de versiones. **Recomendado: informe** (CA-5).
- **H-4 ADR.** No contradice ADR-008/009. Precisa la premisa de ADR-009 §1
  («sale `null` por idempotencia»), que solo vale serializada, y obliga a todo
  escritor futuro (operador, webhook, RFEF). **Recomendado: ADR-019**, que
  precisa ADR-009 §1 con H-1 y H-2 (en `borrador`).
- **Plazo.** Antes de encender `board_delta`/Realtime (paso 2 «al pasar a Pro»
  de SPEC-024 N-1). Sin migración: basta merge y despliegue.
- **Resolución del titular (2026-10-15, Alberto Fojo):** acepta H-1 (A, `for no key
  update`), H-2, H-3 (detección en `informe:jornada`) y H-4 (ADR-019).
