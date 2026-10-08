---
id: SPEC-022
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-08, por: Alberto Fojo}
---
# SPEC-022 — test:db no toca Storage de producción

## Problema
SPEC-020 CA-1 obliga a que `DATABASE_URL` sea loopback en `tools/test-db.mjs` y
en `vitest.db.config.mts`. Storage queda fuera de esa guarda.
`src/raw/store.db.test.ts` toma `rawStoreEnv(process.env)`, y ese valor sale del
`.env`: `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de
**producción** (ADR-014 §1). En cada `npm run test:db` el test crea, lee y borra
`test/<uuid>.json.gz` en el bucket remoto de producción.
**Daño ya hecho:** está anotado en el ledger de SPEC-021 (F-SPEC-021-3): un
put, un get y un remove en producción durante la verificación.
**Plazo:** la próxima ejecución de `test:db`. Cada una escribe en producción
con la service role key.
La misma suite lee del `.env` un secreto de producción sin necesitarlo:
`src/db/cron.db.test.ts` usa `INGEST_TICK_TOKEN`.

## Usuarios / roles afectados
- Titular, sdd-implementador y sdd-verificador: todos lanzan `test:db`.
- Producción: el bucket del raw store (ADR-007).

## Criterios de aceptación
- **CA-1 Storage local forzado (H-1).** Dado `supabase start` y un `.env` con valores de producción, cuando corre `npm run test:db`, entonces `tools/test-db.mjs` toma `API_URL` y `SERVICE_ROLE_KEY` de `supabase status -o env` y los pasa al proceso de vitest como `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, por encima del `.env`. Test en `src/db/test-db.test.ts`, con un `supabase` falso en `PATH` que imprime un status de loopback y un `npx` falso que registra su entorno. El entorno registrado lleva los valores locales.
- **CA-2 Se niega sin Storage local.** Dado que `supabase status` falla, o que su `API_URL` no es loopback según `isLoopbackUrl`, cuando corre `npm run test:db`, entonces sale con código 1 antes de `supabase db push` y de vitest. stderr dice `supabase start` y no imprime ni la URL ni la clave. Test con un `supabase` falso para cada caso: falla, y `API_URL=https://x.supabase.co`.
- **CA-3 Última defensa en la config.** Dado `vitest --config vitest.db.config.mts` lanzado a mano con el `.env` de producción, entonces la config lanza un error si `NEXT_PUBLIC_SUPABASE_URL` no es loopback, como ya hace con `DATABASE_URL`. Test sin red: importa la config en un subproceso con ese entorno y comprueba que falla.
- **CA-4 Sin secretos remotos en la suite.** Dentro del proceso de `test:db`, `API_FOOTBALL_KEY`, `INGEST_TICK_URL`, `INGEST_TICK_TOKEN`, `CRON_SECRET`, `SUPABASE_ACCESS_TOKEN`, `DATABASE_PASSWORD` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` están ausentes o vacías, aunque el `.env` las traiga. Un `.db.test` lo comprueba sobre `process.env`. `src/db/cron.db.test.ts` deja de leer `INGEST_TICK_TOKEN` del entorno y usa un valor fijo, no secreto, como ya hace `src/ingest/cron.db.test.ts`.
- **CA-5 Sin red fuera de loopback (H-2).** Un `setupFiles` de `vitest.db.config.mts` sustituye `globalThis.fetch` por una envoltura. Si el host de la petición no es loopback, rechaza sin conectar y el error nombra el host. Si lo es, delega en el `fetch` real. Test unitario de la envoltura, sin red: `https://v3.football.api-sports.io/...` y `https://x.supabase.co/...` se rechazan, y el `fetch` subyacente es un doble que nunca se llama. `http://127.0.0.1:54321/...` delega. Las suites que ya inyectan dobles de `fetch` siguen verdes.
- **CA-6 El test de Storage sigue vivo, en local.** Con `supabase start` y el `.env` de producción, `npm run test:db` → 0 y `store.db.test.ts` pasa (put, get, remove) contra el bucket local que crea `20260921142313_raw_bucket.sql`. El ledger guarda la salida y `supabase status -o env` con las claves redactadas.
- **CA-7 e2e:db también fijado.** El `webServer.env` de `playwright.db.config.ts` fija `NEXT_PUBLIC_SUPABASE_URL` a `http://127.0.0.1:54321` y deja vacías las variables de CA-4 y `SUPABASE_SERVICE_ROLE_KEY`. Test unitario que importa la config y lo afirma.
- **CA-8 Gates y nada de más.** `npm run gates` → 0. Ficheros que se tocan: `tools/test-db.mjs`, `vitest.db.config.mts`, `playwright.db.config.ts`, una función pura de entorno local en `src/db/env.ts` (o al lado), el setup de `fetch`, `src/db/cron.db.test.ts` y los tests. Nada de migraciones ni dependencias. `src/raw/*` no cambia.

## Entidades y reglas afectadas
Raw store (`dominio.md`); ADR-007 (bucket y service role key), ADR-014 §1
(remoto = producción); SPEC-020 CA-1, guarda que esta spec amplía.

## Fuera de alcance
- `tools/*` operativos (`ingest-tick`, `tick-salud`, `calendario-sync`,
  `reconciliar-*`, `informe-jornada`, `medir-directo`, `cron-setup`). Están
  hechos para ir contra producción o el proveedor, y su guarda es otra
  discusión: EPIC-MANT.
- `npm run dev` y `npm run start` a mano con el `.env` de producción.
- `pg_cron` local: el job `ingest-tick` de la base local hace `net.http_post`
  a lo que diga su vault. Hoy ese vault está vacío. Solo apuntaría a producción
  si alguien corre `cron:setup` contra la base local. Se queda como nota para
  EPIC-MANT.
- `npm test` y `npm run e2e` sin base: corren sobre fixtures y no leen esas
  variables.

## Notas para el gate humano
- **H-1 Forzar más negarse, no una de las dos.** Recomendación: `test-db.mjs`
  fuerza los valores locales (CA-1) para que el flujo normal funcione sin tocar
  el `.env`, y la config se niega (CA-3) por si alguien lanza vitest directo.
  Alternativa rechazada: negarse siempre. Obligaría a editar el `.env` o a
  exportar a mano antes de cada ejecución, y eso se olvida.
- **H-2 Guarda de `fetch` en la suite de base (CA-5).** Recomendación: sí. Es
  la única defensa contra variables que hoy no existen. No cubre `node:http` ni
  sockets crudos (`postgres.js` va por TCP y su host ya lo guarda
  `DATABASE_URL`).
- El finding apuntaba a EPIC-MEJORA. El titular lo trae a EPIC-FIX
  (2026-10-08) porque cada `test:db` ya escribe en producción.
- El nombre `SERVICE_ROLE_KEY` lo da la CLI v2.117. Si cambia, el implementador
  lo anota en el ledger. Lectura opcional para el verificador: listar el prefijo
  `test/` del bucket remoto (solo lectura) y confirmar que no quedan restos.
- **Decididas por el titular (Alberto Fojo, 2026-10-08):** H-1 = combinar forzar y negarse; H-2 = sí, guarda de `fetch`. Spec aprobada.
