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
  - {estado: en-revision, fecha: 2026-10-15, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-15, por: sdd-verificador}
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
  `ingest/informe*.ts`, `ingest/replay-jornada-db.ts`, `calendar/load.ts` y
  sus tests (incluido `db/calendar.db.test.ts`; enmienda 2026-10-15). `git diff main -- src/decide src/model
  src/sources supabase/migrations` vacío. Sin grants ni dependencias nuevas.
  `npm run gates` → 0 y `npm run test:db` en verde. Nada contra producción.
- **CA-7 Carga del calendario sin interbloqueo (V-1, ADR-019 §5).**
  `loadSeason`, antes de su primera escritura en `matches`, toma en **una**
  sentencia SQL propia `select id from matches where season = … and
  competition_id = any(…) order by id for no key update` (todas las
  competiciones de la carga; sin importar de `src/ingest`). Test
  (`db/calendar.db.test.ts` «SPEC-035 CA-7»), conexiones reales: A
  (`afterInsert` de m2) abierta; B (barrido m1..m3, de dos competiciones)
  esperando; C (`loadSeason` de las dos, con el fichero en orden m3, m1, m2).
  Al confirmar A, las tres confirman, ningún 40P01 y los `kickoff` quedan
  cargados. En rojo (40P01) con el `load.ts` de `main`, como
  `_qa/SPEC-035/repro-calendario-load.mjs`.
- **CA-8 Correcciones del replay bajo el cerrojo (V-2, ADR-019 §6).**
  `aplicarCorrecciones` toma el cerrojo de ADR-019 §1 sobre los partidos con
  corrección (la misma sentencia de `engine.ts`, exportada), relee `board`
  bajo el cerrojo y omite la corrección del partido cuyo estado o marcador ya
  no es el `row.board` leído. Test (`replay-jornada.db.test.ts` «SPEC-035
  CA-8»): con otra tx reteniendo m, espera (`wait_event_type = 'Lock'`); si
  entre la lectura y `--aplicar` se confirma otra Decision de m, la de m no
  se escribe y las demás sí. En rojo sin el arreglo.

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
- **H-1 Mecanismo** → A, `for no key update` (ADR-019 §1; rechazadas `for update`, advisory lock y «no barrer»: ADR-019 Alternativas). Aceptado, titular 2026-10-15.
- **H-2 `decided_at`** sigue siendo el `now` del tick (ADR-008 §7, ADR-019 §3; orden por `version`/`recorded_at`, ADR-016). Aceptado, titular 2026-10-15.
- **H-3 Detección** en `informe:jornada` (CA-5), no en `tick:salud`. Aceptado, titular 2026-10-15.
- **H-4 ADR** → ADR-019, que precisa ADR-009 §1 sin superseder. Aceptado, titular 2026-10-15.
- **Plazo.** Antes de encender `board_delta`/Realtime (paso 2 «al pasar a Pro»
  de SPEC-024 N-1). Sin migración: basta merge y despliegue.
- **H-5 (V-1) Otros escritores de `matches`.** Hoy solo `loadSeason`
  (grep de `insert into`/`update`/`delete from matches` en `src/`, `tools/`,
  `supabase/`; `tools/medir-board-delta.mjs` es local y con rollback). Su
  upsert toma `no key update` en orden de fichero y por competiciones. (A)
  Cerrojo previo en una sentencia y `order by id` (CA-7). (B) Ordenar `rows`
  en JS: el `.sort()` no tiene por qué coincidir con la collation de
  `order by id`, y en tandas por competición sigue el ciclo con un barrido que
  las cruza. (C) `lock_timeout` y reintento: la víctima seguiría pudiendo ser
  un `afterInsert`. Coste de A: el motor espera lo que dure la carga (un push).
  **Recomendado: A**, con la enmienda §5 de ADR-019.
- **H-6 (V-2) `replay:jornada --aplicar`.** (A) Dentro: cerrojo y relectura
  (CA-8) y la enmienda §6, que la nombra como única excepción a §2. (B)
  Fuera, como follow-up: deja §2 recién aprobado incumplido y sin dueño. Por
  `decideMatches` no: decide con la ventana de RN-01, no con la jornada, y
  cambiaría lo que corrige SPEC-012 CA-4. **Recomendado: A.**
