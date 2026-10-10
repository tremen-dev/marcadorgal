---
id: SPEC-029
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-10, por: sdd-implementador}
---
# SPEC-029 — Endurecer web_reader, purgar cron y V-7

## Problema
Cuatro arreglos pequeños e independientes de la medición, reunidos por Alberto
Fojo (2026-10-10) para despejar la jornada publicada:
1. **M-11 (a)**: con `DATABASE_URL_PUBLIC` filtrada, `web_reader` puede retener
   el advisory lock de `openAttempt` (`src/ingest/db.ts`, ADR-008 §3; residuo de
   ADR-015 §1) y el tick se queda esperando. **(b)**: puede dejar ajustes en su
   rol (`alter role web_reader set statement_timeout = 1`) que rotar la
   contraseña no deshace; tampoco cierra sus sesiones abiertas, que siguen
   reteniendo el lock. Procedencia: F-SPEC-020-11, V-6 de SPEC-020, ADR-015 §4.
2. **`cron.job_run_details` crece sin límite**: 29 de 68 MB de la base el
   2026-10-07 (tick cada 30 s, ~2.880 filas/día); es lo único que acerca el plan
   Free (500 MB) a su tope.
3. **V-7 de SPEC-024**: con `NEXT_PUBLIC_REALTIME=on` cada carga pinta «Sen
   tempo real» ~15 ms antes de que cargue el transporte (`XornadaLive.tsx`
   arranca en `mode: "polling"`).
4. **M-12**: `npm run cron:setup` contra la base local con el `.env` de
   producción haría que el pg_cron local disparase el tick de producción.

## Usuarios / roles afectados
Titular (opera `db:web-reader`, `cron:setup`, `db:push`, `tick:salud`,
`informe:jornada`). Público: solo CA-6, y solo con Realtime encendido.

## Criterios de aceptación
- **CA-1 El lock ocupado se salta, no se espera.** Dado que otra sesión retiene
  el advisory lock de la fuente, cuando el tick llama a `openAttempt`, entonces
  usa `pg_try_advisory_xact_lock` con la misma clave, devuelve
  `{ skipped: "locked" }` en < 1 s sin insertar intento y el tick resume esa
  fuente con `skipped: "locked"`, sin `fetch`, sigue con las demás y corre el
  barrido. Con el lock libre, RN-08 se comporta como hoy. Tests:
  `db.db.test.ts` «SPEC-029 CA-1 lock retenido por web_reader: salta sin
  esperar» (sesión de `web_reader` con `pg_advisory_lock`; 0 filas; al soltarlo,
  abre) y el de carrera de CA-6 sin cambios; `tick.test.ts` «SPEC-029 CA-1»
  (doble en `memory.ts`: 0 llamadas a `fetch`, barrido llamado).
- **CA-2 Rotar deja el rol limpio.** Cuando corre `npm run db:web-reader`,
  entonces, tras la contraseña, hace `alter role web_reader reset all` y
  `… in database <d> reset all` por cada `setdatabase` de `pg_db_role_setting`,
  y falla (salida ≠ 0, sin valores en pantalla) si queda alguna fila para el
  rol. Test `web-reader.db.test.ts` «SPEC-029 CA-2» con ajustes sembrados
  global y por base → 0 filas.
- **CA-3 Rotar corta las sesiones abiertas** (H-2). Además termina con
  `pg_terminate_backend` las sesiones de `web_reader` e imprime cuántas. Test
  «SPEC-029 CA-3»: una sesión de `web_reader` con el lock de CA-1 → tras correr,
  fuera de `pg_stat_activity` y `openAttempt` abre.
- **CA-4 Purga diaria del historial de pg_cron** (H-3, H-4). Una migración
  programa, idempotente como `20260921203746_ingest_tick_job.sql`,
  `purge-cron-history` a diario (`17 4 * * *`): `delete from
  cron.job_run_details where start_time < now() - interval '14 days'`. Tests
  `src/db/cron.db.test.ts` «SPEC-029 CA-4»: una sola fila, activa, con ese
  `schedule`; su comando, ejecutado en transacción con rollback sobre filas
  sembradas a −15 d y −13 d, borra solo la de −15 d; `ingest-tick` intacto.
- **CA-5 Los lectores siguen sanos.** `tick:salud` con dos jobs y el diario sin
  ejecuciones en 10 min → `ok: true` (`salud.test.ts` «SPEC-029 CA-5»); un
  `failed` del diario en la ventana corta → `ok: false` con su nombre. El
  informe de jornada (SPEC-017 CA-5) no cambia de código: 14 días cubren una
  ventana de jornada (≤ 4 días) generada hasta 10 días después de cerrar.
- **CA-6 Sin aviso antes de arrancar (V-7)** (H-5). `transportNotice` recibe
  `started` y devuelve `null` mientras sea `false`; `XornadaLive` se lo pasa.
  Test `freshness.test.ts` «SPEC-029 CA-6»: `{realtime: true, mode: "polling",
  started: false}` → `null` (rojo antes del arreglo), con `started: true` →
  `freshness.polling`. Verif.: Realtime local, MutationObserver en 3 cargas → 0
  apariciones de «Sen tempo real» y el reintento de V-1 lo sigue mostrando.
- **CA-7 `cron:setup` no cruza entornos (M-12).** Con `DATABASE_URL` loopback
  (`isLoopbackUrl`) e `INGEST_TICK_URL` cuyo host no es loopback ni
  `host.docker.internal`, `cronSecrets` lanza nombrando las dos variables, sin
  valores, y no se escribe nada en Vault. Tests `cron.test.ts` «SPEC-029 CA-7»
  (rechaza; local+local y remoto+remoto pasan).
- **CA-8 Fronteras y gates.** Una migración nueva; sin grants nuevos: el
  inventario de ADR-015 §3 (`web.db.test.ts`) sin tocar y verde. Bajo `src/`:
  `ingest/{db,tick,memory,cron}.ts`, `db/web-reader.ts`,
  `xornada/freshness.ts`, `XornadaLive.tsx` y sus tests; `src/decide` intacto.
  Sin dependencias nuevas. `npm run gates` → 0 y `npm run test:db` verde. Nada
  se prueba contra producción.

## Entidades y reglas afectadas
Tick (`dominio.md`); RN-08 (`reglas.md`). ADR-008 §3, ADR-007 §5, ADR-014 §4,
ADR-015 §1, §3, §4. SPEC-017 CA-5; SPEC-024 CA-8 (V-1, V-7); SPEC-008 CA-4/CA-7.

## Fuera de alcance
Quitar el advisory lock (alternativa de H-1); cerrar el resto del residuo de
ADR-015 §1; reducir `net._http_response` (pg_net ya poda); `VACUUM FULL`; M-9.

## Notas para el gate humano
- **H-1 Lock (CA-1).** (A) `try` y saltar: no cuelga el tick y el barrido corre,
  pero una fuente sigue sin sondear mientras dure la filtración, hasta rotar
  (CA-3); (B) cerrojo sobre `ingest_attempts` (sin grants para `web_reader`):
  cierra el hueco, exige ADR que precise ADR-008 §3. `lock_timeout` haría
  fallar el intento en vez de saltarlo. **Recomendado: A.**
- **H-2** ¿`db:web-reader` termina las sesiones de `web_reader`? Sin ello, rotar
  no suelta un lock retenido; coste: la web reconecta (milisegundos).
  **Recomendado: sí.**
- **H-3 Retención 14 días.** ~25 MB estables al ritmo medido; 7 días cabe
  justo para el informe. **Recomendado: 14.** Regenerar una jornada de hace > 14
  días dará `pg_cron: sin datos` (SPEC-017 CA-5 no lanza).
- **H-4 Job de pg_cron propio**, no la purga de raw de ADR-007 §5: solo SQL, sin
  código desplegado. `cron.log_run = off`: rechazado (rompe CA-5 y salud).
  **Recomendado: job propio.**
- **H-5 V-7: sin aviso hasta `started`**, en vez de arrancar en `connecting`:
  la pantalla servida ya es el estado anterior al transporte. **Recomendado.**
- **Despliegue** (fuera de la ventana de una jornada): 1) merge → Vercel (el
  código no depende de la migración); 2) `npm run db:push`; 3) `npm run
  db:web-reader` con la contraseña vigente; 4) el titular, solo lectura: `select
  jobname, schedule, active from cron.job`, al día siguiente `select
  min(start_time) from cron.job_run_details` y `npm run tick:salud`.
- **Decididas por el titular (Alberto Fojo, 2026-10-10):** H-1 = A (lock `try` y saltar la vuelta); H-2..H-5 según recomendación. Spec aprobada.
