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
| CA-1 | `src/ingest/db.ts` (`pg_try_advisory_xact_lock`, `{ skipped: "locked" }`), `src/ingest/tick.ts`, `src/ingest/memory.ts` (`locked`) | `src/ingest/db.db.test.ts` «SPEC-029 CA-1 lock retenido por web_reader: salta sin esperar» (rojo: timeout 5 s; verde) + «CA-6 openAttempt under concurrency» sin cambios; `src/ingest/tick.test.ts` «SPEC-029 CA-1» | | ❌ |
| CA-2 | `src/db/web-reader.ts` `resetWebReaderSettings`; `tools/db-web-reader.mjs` | `src/db/web-reader.db.test.ts` «SPEC-029 CA-2» (script real contra local; rojo 2→2, verde 0); `src/db/web-reader.test.ts` «SPEC-029 CA-2 resetWebReaderSettings» (fila restante → error sin valores) | | ❌ |
| CA-3 | `src/db/web-reader.ts` `terminateWebReaderSessions`; `tools/db-web-reader.mjs` («web_reader: N sesión/sesiones cerrada(s)») | `src/db/web-reader.db.test.ts` «SPEC-029 CA-3» (sesión con el lock → fuera de `pg_stat_activity`, `openAttempt` abre) | | ❌ |
| CA-4 | `supabase/migrations/20261010120000_spec029_purge_cron_history.sql` | `src/db/cron.db.test.ts` «SPEC-029 CA-4» (una fila activa `17 4 * * *`; −15 d borrada, −13 d queda, rollback; `ingest-tick` intacto) | | ❌ |
| CA-5 | sin cambio de código (`src/ingest/salud.ts`, `informe*.ts` intactos) | `src/ingest/salud.test.ts` «SPEC-029 CA-5» (dos jobs → ok; `failed` del diario → REVISAR con su nombre). Verdes desde el primer run: CA de no regresión | | ❌ |
| CA-6 | `src/xornada/freshness.ts` (`started?`), `src/components/xornada/XornadaLive.tsx` | `src/xornada/freshness.test.ts` «SPEC-029 CA-6» (rojo: `freshness.polling` en vez de `null`; verde). MutationObserver: pendiente de Verif. | | ❌ |
| CA-7 | `src/ingest/cron.ts` (`assertSameEnvironment` en `cronSecrets`) | `src/ingest/cron.test.ts` «SPEC-029 CA-7» (rechaza local+remoto sin valores y sin llamadas a Vault; local+local, local+host.docker.internal y remoto+remoto pasan) | | ❌ |
| CA-8 | 1 migración, 0 grants, 0 dependencias; `src/decide` intacto (`git diff e16e4ae..HEAD -- src/decide` vacío) | `npm run gates` → 0 (1501 tests); `test:db` local → 195/195 (incl. `web.db.test.ts` sin tocar); `npm run e2e` → 136 passed; `npm run e2e:db` → 47 passed | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-029/. Informe HTML opcional: _qa/SPEC-029/informe.html -->

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
