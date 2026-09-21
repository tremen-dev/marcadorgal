---
id: ADR-008
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-21, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-008: Núcleo de ingesta: tick autenticado, cadencia, concurrencia y puntos de enganche

- Deciders: sdd-arquitecto propone (2026-09-21); Alberto Fojo fija en el gate de SPEC-006 (2026-09-21) las alternativas abiertas (ver Decisión); aprobación formal pendiente.
- Specs relacionadas: SPEC-006 (origen); las specs c (motor) y d (despliegue) de EPIC-002 y EPIC-004 (push y operador) lo consumen.

## Contexto

ADR-002 fija `POST /api/ingest/tick` con token, dos disparadores (pg_cron cada
30 s y Vercel Cron cada minuto) y la ventana por partido; ADR-003, una fila de
`ingest_attempts` por llamada a adaptador con errores aislados; ADR-004, el
motor en la misma transacción que las observaciones. Quedan sin fijar: el
detalle de la autenticación, cómo se respeta RN-08 con dos disparadores que se
solapan, el orden interno del intento, cómo se prueba el tick en CI sin base
(SPEC-002 N-7), cómo llega el alias al servidor (SPEC-005 N-3) y por dónde
enchufan el motor y las fuentes push.

## Decisión

1. **Autenticación**: `Authorization: Bearer <INGEST_TICK_TOKEN>`, token de
   ≥ 32 caracteres, comparado con `crypto.timingSafeEqual`. Sin token
   configurado el endpoint responde 503 y no corre: nunca un tick sin llave.
2. **Ventana** = ADR-002 §2, calculada sobre `board` (estado vigente): un
   partido sale de ventana por tiempo o por Decision `finished`.
3. **Un intento por (fuente `pull`, temporada) y tick**, en el orden del
   registro; el error de uno no toca a los demás. **Cadencia (RN-08)**: se
   salta la fuente si su último `started_at` es más reciente que
   `minIntervalSeconds − 5 s` (tolerancia al jitter de los disparadores;
   decidido en el gate: el registro sigue en 30 s). La
   comprobación y el alta del intento van en una transacción con
   `pg_advisory_xact_lock` por fuente: dos ticks simultáneos producen una sola
   llamada al proveedor.
4. **Orden del intento**: alta en `ingest_attempts` → `fetch` → guardar crudo
   (ADR-007) → `parse` → una transacción con `observations`, alertas
   `unresolved_team` y `afterInsert` → cierre del intento con contadores en
   `details`. Sin partidos en ventana no hay intento ni petición.
5. **Puerto `IngestDb`** (interfaz con `windowMatches`, `openAttempt`,
   `closeAttempt`, `transaction`, purga) con implementación `postgres.js` y
   otra en memoria: el tick se prueba en CI sin base; la implementación real,
   con `npm run test:db` en local.
6. **Puntos de enganche**: `afterInsert(tx, observations)` es donde la spec c
   ejecuta el motor, dentro de la misma transacción; `IngestTx.insertObservations`
   es la única vía de escritura de `observations`, que reutilizarán el webhook y
   el operador (EPIC-004). Ninguna fuente escribe por su cuenta (D-5).
7. **Reloj en el borde**: `now` lo pone la ruta (o la CLI) y viaja como
   `Instant`; nada bajo `src/ingest/` ni `src/raw/` consulta el reloj.
8. **Alias en runtime**: el núcleo lee `data/alias/<temporada>/<fuente>.json`
   con `node:fs` (trazado en el despliegue con `outputFileTracingIncludes`) y
   se lo inyecta al adaptador; la temporada la dan los partidos en ventana.
9. **CLI `npm run ingest:tick`** con el mismo núcleo que la ruta, para
   verificar y medir sin HTTP.

## Consecuencias

### Positivas
Dos disparadores sin doble sondeo. Cada entrada (pull, push, operador) escribe
igual y el motor corre igual. Todo el tick se prueba con dobles en CI.

### Negativas / follow-ups
Fuera de ventana no queda rastro en base: la vitalidad del tick se observa en
los logs de Vercel y en `cron.job_run_details` (spec d). La tolerancia de
5 s permite dos llamadas separadas 25 s en el peor caso. El alias por temporada
exige el fichero en el despliegue; una temporada nueva es un fichero nuevo, no
código.

## Alternativas consideradas

- **Índice único para la cadencia**: no expresa «ninguna en 30 s».
- **`minIntervalSeconds: 25` en el registro con guarda estricta**: mueve el
  jitter del disparador a un dato de cortesía (RN-08) y toca SPEC-005.
- **`pg_advisory_lock` de sesión**: no sobrevive al pooler transaccional.
- **Fila de latido por tick fuera de ventana**: 2.880 filas/día sin dato.
- **Import estático del JSON de alias**: una línea de código por temporada.
- **Tabla `match_aliases`**: `team_aliases` indexa por nombre y el adaptador
  resuelve por id externo; exigiría rehacer el esquema para nada.
- **Runtime Edge**: sin `node:zlib` ni `postgres.js`.
- **`GET` además de `POST`** (Vercel Cron llama por GET): pospuesto a la spec d
  por decisión del gate; aquí solo `POST`.
