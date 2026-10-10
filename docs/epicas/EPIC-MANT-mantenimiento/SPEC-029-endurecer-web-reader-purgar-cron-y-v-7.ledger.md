---
id: SPEC-029
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-029 Endurecer web_reader, purgar cron y V-7

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-029-endurecer-web-reader-purgar-cron-y-v-7`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/db.ts` (`pg_try_advisory_xact_lock`, `{ skipped: "locked" }`), `src/ingest/tick.ts`, `src/ingest/memory.ts` (`locked`) | `src/ingest/db.db.test.ts` «SPEC-029 CA-1 lock retenido por web_reader: salta sin esperar» (rojo: timeout 5 s; verde) + «CA-6 openAttempt under concurrency» sin cambios; `src/ingest/tick.test.ts` «SPEC-029 CA-1» | Repro local con `runTick` real (IngestDb local) y sesión `web_reader` con `pg_advisory_lock(hashtext('ingest_attempts:v029-locked'))`: tick 13 ms, `v029-locked` → `skipped: locked`, 0 filas; `v029-free` hace fetch y abre; barrido 1. Lock suelto (+40 s): ambas abren; +50 s: `cadence` (RN-08). Test de carrera sin diff. `test:db` 195/195 | ✅ |
| CA-2 | `src/db/web-reader.ts` `resetWebReaderSettings`; `tools/db-web-reader.mjs` | `src/db/web-reader.db.test.ts` «SPEC-029 CA-2» (script real contra local; rojo 2→2, verde 0); `src/db/web-reader.test.ts` «SPEC-029 CA-2 resetWebReaderSettings» (fila restante → error sin valores) | `db:web-reader` real (cwd sin `.env`, DB local) con `statement_timeout=1` global + `work_mem` por base: salida «contraseña actualizada / ajustes del rol restablecidos», exit 0, `pg_db_role_setting` 2 → 0; contraseña y valores ausentes de la salida (grep 0) | ✅ |
| CA-3 | `src/db/web-reader.ts` `terminateWebReaderSessions`; `tools/db-web-reader.mjs` («web_reader: N sesión/sesiones cerrada(s)») | `src/db/web-reader.db.test.ts` «SPEC-029 CA-3» (sesión con el lock → fuera de `pg_stat_activity`, `openAttempt` abre) | Misma corrida con sesión `web_reader` reteniendo el lock: «1 sesión cerrada», sesión muerta (`CONNECTION_CLOSED`), `pg_stat_activity` 0. 42501 simulado (operador CREATEROLE + ADMIN sin `pg_signal_backend`): exit 1, «no se pudo actualizar (42501)» tras contraseña y ajustes ya aplicados; sesión sigue; repetir como `postgres` la cierra. Local `postgres`: no superuser, miembro de `pg_signal_backend` | ✅ |
| CA-4 | `supabase/migrations/20261010120000_spec029_purge_cron_history.sql` | `src/db/cron.db.test.ts` «SPEC-029 CA-4» (una fila activa `17 4 * * *`; −15 d borrada, −13 d queda, rollback; `ingest-tick` intacto) | Migración aplicada (`20261010120000`); `cron.job`: `purge-cron-history 17 4 * * * t postgres` + `ingest-tick` intacto. Migración ejecutada 2× en tx: una sola fila. Comando sobre −15 d/−13 d: `DELETE 1`, queda −13 d; rollback. Sin `grant` en el SQL | ✅ |
| CA-5 | sin cambio de código (`src/ingest/salud.ts`, `informe*.ts` intactos) | `src/ingest/salud.test.ts` «SPEC-029 CA-5» (dos jobs → ok; `failed` del diario → REVISAR con su nombre). Verdes desde el primer run: CA de no regresión | `salud.test.ts` CA-5 verde (2 casos); `salud.ts`, `informe*.ts`, `tick-salud.mjs` sin diff. Lectores sin filtro por job: el diario suma 1 ejecución/día al informe (despreciable) | ✅ |
| CA-6 | `src/xornada/freshness.ts` (`started?`), `src/components/xornada/XornadaLive.tsx` | `src/xornada/freshness.test.ts` «SPEC-029 CA-6» (rojo: `freshness.polling` en vez de `null`; verde). MutationObserver: pendiente de Verif. | Build `e2e:db` (Realtime local, `NEXT_PUBLIC_REALTIME=on`), MutationObserver desde `addInitScript`, 3 cargas hasta `data-transport=realtime`: 0 apariciones en rama; en `origin/main` 1 por carga (106–152 ms) → el observador detecta V-7. Socket cerrado (V-1): aviso aparece. `_qa/SPEC-029/CA-6-*.png` | ✅ |
| CA-7 | `src/ingest/cron.ts` (`assertSameEnvironment` en `cronSecrets`) | `src/ingest/cron.test.ts` «SPEC-029 CA-7» (rechaza local+remoto sin valores y sin llamadas a Vault; local+local, local+host.docker.internal y remoto+remoto pasan) | `cron:setup` real, DB local + `INGEST_TICK_URL` remota: exit 1, mensaje nombra las dos variables sin valores; `vault.secrets` 0 → 0 filas. `cron.test.ts` CA-7 verde | ✅ |
| CA-8 | 1 migración, 0 grants, 0 dependencias; `src/decide` intacto (`git diff e16e4ae..HEAD -- src/decide` vacío) | `npm run gates` → 0 (1501 tests); `test:db` local → 195/195 (incl. `web.db.test.ts` sin tocar); `npm run e2e` → 136 passed; `npm run e2e:db` → 47 passed | `git diff origin/main...HEAD`: 1 migración, 0 grants, `src/decide`, `src/live`, `web.db.test.ts`, `package*.json` sin diff; ficheros `src/` = lista. `DATABASE_URL_PUBLIC="" npm run gates` → 0 (1501/1501); `test:db` 195/195; `e2e` 136 passed; `e2e:db` 47 passed, 1 skipped (capturas QA sin `QA_CAPTURE_DIR`) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-10-10 (sdd-verificador).** CA-1..CA-8 ✅ con evidencia propia, todo en local. Sin findings bloqueantes. Observaciones:
- **O-1 (baja)** F-SPEC-029-1: con 42501 el sistema queda seguro (contraseña y ajustes ya aplicados; el tick no se cuelga por CA-1; solo esa fuente se salta). Pero «las sesiones caen solas al reconectar el pooler» no está demostrado: en local la sesión sobrevive. Remedio si ocurre: terminar a mano (dashboard/`supabase_admin`). El texto «no se pudo actualizar» engaña cuando la contraseña sí se cambió.
- **O-2 (info)** El informe y `tick:salud` cuentan las ejecuciones de `purge-cron-history` con las de `ingest-tick` (1/día, despreciable).
- **F-SPEC-029-2** aceptable como follow-up: el salto solo se ve en el JSON del tick (`net._http_response`, ~6 h); una filtración larga se ve como silencio de la fuente.
- **F-SPEC-029-3** sin riesgo hoy: el único llamador (`XornadaLive`) pasa `started`.
- Procedimiento del titular: correcto y seguro. En una filtración real, rotar con contraseña **nueva** (la «vigente» es la filtrada); vaciar el portapapeles tras pegar en Vercel.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-029/. Informe HTML opcional: _qa/SPEC-029/informe.html -->
| CA | Captura (local, sin versionar) |
|---|---|
| CA-6 | `_qa/SPEC-029/CA-6-load-1.png`, `-load-2.png`, `-load-3.png` (Realtime, sin aviso) |
| CA-6 (V-1) | `_qa/SPEC-029/CA-6-v1-retry.png` (socket cerrado → «Sen tempo real: actualízase cada 30 s») |

## Salvedades / follow-ups
<!-- IDs F-SPEC-029-1, F-SPEC-029-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-029-1** `pg_terminate_backend` como `postgres` funciona en local (CA-3 verde); en producción no se ha probado (prohibido). Si falla, `db:web-reader` sale con `no se pudo actualizar (42501)` **después** de haber cambiado contraseña y ajustes: repetir no hace daño; las sesiones caen solas al reconectar el pooler. Destino: observar en el despliegue.
- **F-SPEC-029-2** Un salto `locked` no deja fila en `ingest_attempts` (CA-1: «sin insertar intento»): `tick:salud` e `informe:jornada` no lo ven; solo la respuesta JSON del tick. Una filtración sostenida se notaría como silencio de la fuente. Destino: EPIC-MANT si se quiere registrar.
- **F-SPEC-029-3** `started` es opcional en `transportNotice` para no tocar `src/live/transport.test.ts` (fuera de la lista de ficheros); la página siempre lo pasa.
- **F-SPEC-029-4** Regenerar una jornada de hace > 14 días dará `pg_cron: sin datos` (H-3, aceptado).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Hecho: CA-1..CA-8 implementados con test en la rama `ft/SPEC-029-endurecer-web-reader-purgar-cron-y-v-7` (sale de `docs/SPEC-029-mant`, PR #59 sin fusionar). Falta: Verif. (incl. MutationObserver de CA-6 con Realtime local) y el despliegue del titular. Nada se ha ejecutado contra producción.

**Procedimiento del titular** (después de la jornada en curso, 2026-10-09/12):
1. Merge de #59 y de esta rama → Vercel despliega (el código no depende de la migración).
2. `npm run db:push` (aplica `20261010120000_spec029_purge_cron_history.sql`).
3. `npm run db:web-reader` con la contraseña vigente en `WEB_READER_PASSWORD` del `.env`. Salida esperada: `contraseña actualizada`, `ajustes del rol restablecidos`, `web_reader: N sesiones cerradas`. Sin cambio en Vercel.
   **Si no tienes la contraseña vigente**, genera una nueva sin imprimirla (zsh, en la raíz):
   ```sh
   export WEB_READER_PASSWORD="$(openssl rand -hex 32)"   # gana sobre el .env
   npm run db:web-reader
   # Si el .env tiene la DATABASE_URL_PUBLIC vigente: cambia solo la contraseña
   node -e 'process.loadEnvFile();const u=new URL(process.env.DATABASE_URL_PUBLIC);u.password=process.env.WEB_READER_PASSWORD;process.stdout.write(u.toString())' | pbcopy
   # Si no: la del pooler (6543) de DATABASE_URL con usuario web_reader.<ref> (SPEC-020 ledger, paso 6)
   # node -e 'process.loadEnvFile();const u=new URL(process.env.DATABASE_URL);u.username=u.username.replace(/^postgres(?=\.|$)/,"web_reader");u.port="6543";u.password=process.env.WEB_READER_PASSWORD;process.stdout.write(u.toString())' | pbcopy
   unset WEB_READER_PASSWORD
   ```
   Pega el portapapeles en Vercel → `DATABASE_URL_PUBLIC` (Production y Preview) y redeploy de producción; hasta entonces la web servirá «non dispoñible». Comprueba antes que host y puerto coinciden con el valor anterior de Vercel.
4. Solo lectura: `select jobname, schedule, active from cron.job` (dos filas: `ingest-tick 30 seconds`, `purge-cron-history 17 4 * * *`, ambas activas); al día siguiente `select min(start_time) from cron.job_run_details` (≥ hoy − 14 d) y `npm run tick:salud` → OK; `select count(*) from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where r.rolname = 'web_reader'` → 0.
