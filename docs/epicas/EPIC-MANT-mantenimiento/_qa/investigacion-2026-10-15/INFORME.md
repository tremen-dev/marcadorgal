# Investigación 2026-10-15: dos anomalías de la jornada 2026-10-09/12

Solo lectura: `q.mjs` abre `begin read only` + `statement_timeout 30s`. Ninguna
petición a API-Football. Ningún fichero del repo tocado. Salidas: `NN-*.sql`,
`NN-*.json`, `NN.txt` en esta carpeta.

## 1. Decisiones concurrentes (RN-05 `sen_sinal` v2/v3)

**Causa raíz:** dos ticks distintos ejecutan `decideMatches` sobre el mismo
partido a la vez, y nada lo serializa. El advisory lock solo cubre `openAttempt`.

- **Escritor de la v3** (`decided_at` 15:45:04.084): el tick de **pg_cron**. En
  `cron.job_run_details` aparece el job 2 a las 15:45:04.010 (`15.txt`). Es el
  dueño del intento `8a60b24f` (`started_at` = 04.084, `03.txt`), y la v3 sale de
  su `afterInsert`: las 10 Decisions con `decided_at` 04.084 se graban
  seguidas entre 08.457 y 09.444, en orden alfabético de `match_id`. Es el `ids` ordenado de
  `src/ingest/engine.ts:247` (`04.txt`), y los dos partidos tienen observación
  `scheduled` con `received_at` 04.084 (`02.txt`).
- **Escritor de la v2** (06.353): el tick de **Vercel Cron**
  (`vercel.json`: `* * * * *`; la ruta acepta GET, `route.ts:43`). Su intento se
  salta por cadencia: el de pg_cron ya estaba confirmado (`opened_at` 04.756) y
  no hay fila en `ingest_attempts` (`60`, `03.txt`). Solo corre su **barrido**
  (`src/ingest/tick.ts:163-169`), que graba v2 a las 07.869 y 08.014.
- **Interleaving:** la transacción de pg_cron lee `currents`
  (`engine.ts:257-262`) antes de que confirme el barrido de Vercel, así que ve
  la v1 y la idempotencia por tupla (`src/decide/engine.ts:252`) no la frena. Su
  INSERT llega después de esa confirmación (09.163), y el trigger da `max+1 = 3`.
- **`version`:** la pone el trigger `assign_decision_version` (`coalesce(max(version),0)+1`,
  `supabase/migrations/20260920220153_append_only_logs.sql:68-79`), con unique `(match_id, version)` (l. 64).
  **`decided_at`** es el `now` del tick, fijado en la ruta al empezar
  (`route.ts:27-37`; `src/decide/engine.ts:242`). No es el instante de escritura,
  y por eso se invierte. El orden real lo da `recorded_at` (`clock_timestamp()`,
  migración spec025).
- **El advisory lock no falló.** Hizo su trabajo: hubo una sola llamada al
  proveedor (`src/ingest/db.ts:213-232`, ADR-008 §3). Ese lock nunca cubrió el
  motor. El pendiente «blindar el advisory lock de `openAttempt`» (ADR-015 §1, H-4)
  es otro problema: el lock retenido por PUBLIC/web_reader. Este caso no lo arregla.

**Alcance histórico** (`10.txt`, `11.txt`, `16-clasificacion-pares.txt`), sobre 11.347
Decisions entre el 22-09 y el 12-10:
- 36 filas con la misma tupla publicada que su versión anterior, en 23 partidos.
  Hay casos en 7 de las jornadas (25, 26 y 27-09; 02, 03 y 04-10; 10, 11 y 12-10). En **todos**
  hay una escritura del tick con intento (pg_cron) y otra del tick sin intento
  (Vercel, solo barrido), con 1-4 s de diferencia entre sus `now`.
- 4 tienen `decided_at` invertido: ceuta-real-sociedad-b v107 y
  granada-andorra v113 el 26-09, y las dos de hoy.
- 0 casos de inversión con contenido distinto, 0 con el mismo `now` y otra tupla,
  0 errores `duplicate/unique` en `ingest_attempts` (`12.txt`).

**Daño hoy: ninguno visible.** Las filas duplicadas son idénticas, así que `board` muestra
la misma tupla. El trigger `board_delta` está **deshabilitado** (`tgenabled = D`,
`13.txt`), así que Realtime no emite nada. Coste: filas de más y `decided_at` no
monótono (afecta a la medición si se usa `decided_at` como orden).

**Daño latente** (no observado):
- (a) Un barrido que lee las observaciones antes de que confirme un gol y graba
  después publica una versión mayor con el marcador viejo. Además, RN-03 no la frena,
  porque compara contra un `current` rancio. El gol desaparecería hasta el
  siguiente tick.
- (b) Si los dos INSERT se cruzan con la otra transacción sin confirmar, el
  segundo espera en el índice único y falla con 23505. Si es el `afterInsert`,
  se deshace la transacción entera con las observaciones del intento (el crudo
  queda). Si es el barrido, el error se queda en `engineError`, solo en logs.
- (c) Con `board_delta` encendido, se emite dos veces o en desorden.

**Dónde:** EPIC-MANT, porque hoy es silencioso. Conviene hacerlo antes de
encender `board_delta`/Realtime, porque (a) y (b) ya serían daño.

**Arreglo mínimo:** serializar el motor por partido dentro de su transacción.
En `src/ingest/engine.ts:252-253`, `select … from matches where id = any(…) order
by id for update`, o `pg_advisory_xact_lock(hashtext('decide:'||id))` en orden.
Con READ COMMITTED, la siguiente sentencia (`currents`) ya ve la versión
confirmada del otro, y la idempotencia devuelve `null`. El `order by` evita
interbloqueos. Test de base: dos `decideMatches` concurrentes producen una sola fila.

## 2. «Suspendido tardío» en rayo-vallecano-athletic-club

**No es un defecto. La premisa venía de una consulta incompleta.** `51-rayo.sql`
filtraba `version<=3 or version>=38` y ocultaba las v4-v37. La serie completa
(`21.txt`, cruzada con `20.txt`):

| v | estado | minuto | `decided_at` (= observación) |
|---|---|---|---|
| 29 | live | 27 | 12:29:01.786 |
| **30** | **suspended** | – | **12:30:03.601**, la primera obs. `suspended` |
| 31 | live | null | 12:30:31.930 |
| 32 | suspended | – | 12:31:02.103 |
| 33-40 | live | 25→32 | 12:46:32-12:53:03 |
| 41 | suspended | – | 12:54:03.349, la segunda suspensión |

Cada observación que cambia la tupla publica en su mismo tick, por RN-01
`provisional`, sin retraso ni histéresis. Es lo que fija ADR-012 §1 (lo da la
fuente ganadora) y §3 (salir es una transición más), con la guarda de
`src/decide/engine.ts:81-95`: solo `finished` es terminal. Publica
`engine.ts:525`. El parpadeo de 12:30-12:31 es la consecuencia aceptada en ADR-012,
«Negativas»: `INT` → `suspended` «parpadea».

**Dónde:** nada. Un detalle aparte: el minuto vuelve de 27 a 25 al reanudar (v33).
RN-03 solo protege el marcador, así que no es un defecto según las reglas.

Hay que corregir la línea 30 de `jornada-2026-10-09/INFORME.md`: el `suspended`
se publicó a las 12:30:03Z.
