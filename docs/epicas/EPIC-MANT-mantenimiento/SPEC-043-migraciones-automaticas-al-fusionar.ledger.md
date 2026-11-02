---
id: SPEC-043
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-043 Migraciones automáticas al fusionar

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-043-migraciones-automaticas-al-fusionar`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `.github/workflows/migraciones.yml` | actionlint 1.7.7 (Docker `rhysd/actionlint:1.7.7`, shellcheck 0.10.0) sobre los 4 YAML del export LF de `39c77d4`: exit 0, sin salida | actionlint 1.7.7 (shellcheck 0.10.0) sobre los 4 YAML del export LF de `ae99d44` y sobre el worktree: exit 0, sin salida | ✅ |
| CA-2 | `.github/workflows/migraciones.yml` (paso «Guardia», env `MODO`) | `src/arch/migraciones-workflow.test.ts` › «SPEC-043 CA-2 …» (9 casos). Run rojo de la guardia: tras el merge (handoff, paso 3) | Estático: 20/20 tests verdes; YAML leído (push main sin `paths`, dispatch `modo` choice/dry-run, concurrency, `contents: read`, timeout 10, CLI 2.122.0). Guardia ejecutada en bash `-eo pipefail`: aplicar+`refs/heads/ft/…`→1, aplicar+tag→1, modo vacío/desconocido→1, aplicar+main→0, dry-run+rama→0. Run rojo real: pendiente tras el merge | 🚧 |
| CA-3 | `migraciones.yml` (paso «Enmascarar…»), `tools/mascara-db-url.mjs` | `src/arch/migraciones-workflow.test.ts` › «CA-3 one secret, never printed» (3) y «CA-3 tools/mascara-db-url.mjs» (2). `grep -cF` de los logs: tras el merge (handoff, paso 5) | Estático: único secreto, por `env`, sin `${{` en `run:`. CLI 2.122.0 real con URL errónea (auth, TLS, DNS): imprime `host=… user=…` (host 1-2, usuario 1-2 apariciones); tras aplicar las máscaras de `mascara-db-url.mjs` → url/host/user/pass/pass codificada = 0. `grep -cF` de logs reales: pendiente tras el merge | 🚧 |
| CA-4 | `migraciones.yml` (rama `--dry-run`) | Sondeo local (Postgres 17 en Docker, CLI 2.122.0): dry-run «Would push these migrations: • 20261102120000_…», exit 0. Real: tras el merge (handoff, paso 2) | Local (Postgres 17 efímero con el historial de `origin/main`, 26 versiones): `db push --dry-run` exit 0, «Would push … 20261102120000»; `migration list` antes/después idéntico (`diff` vacío). Real: pendiente tras el merge | 🚧 |
| CA-5 | `supabase/migrations/20261102120000_spec043_harmless_comment.sql` | `src/arch/migraciones-workflow.test.ts` › «CA-5 the harmless migration». Sondeo local: aplica y la 2.ª pasada dice «Remote database is up to date.», exit 0. Real: tras el merge (handoff, paso 4) | Local: aplica 20261102120000 (exit 0, comentario del esquema `web` escrito); 2.ª pasada «Remote database is up to date.» exit 0. Orden Vercel/check real: pendiente y mal preparado (V-1) | 🚧 |
| CA-6 | `migraciones.yml` (`defaults.run.shell: bash`, sin `continue-on-error` ni `\|\| true`) | `src/arch/migraciones-workflow.test.ts` › «CA-6 …» (2). Deployment Check en Vercel y captura `_qa/SPEC-043/`: tras el merge (handoff, paso 1) | YAML: sin `continue-on-error` ni `|| true`, `defaults.run.shell: bash`. Local: `db push` con SQL roto → exit 1. Falta la cita de la documentación de Vercel que exige el CA (V-3); captura del Deployment Check pendiente tras el merge | ❌ |
| CA-7 | `.github/workflows/calendario-semanal.yml` (paso «Fusionar y cargar…») | `src/arch/migraciones-workflow.test.ts` › «CA-7 …»; actionlint (CA-1) | Diff de `calendario-semanal.yml`: el dispatch va tras `gh pr merge`, job con `actions: write` y `GH_TOKEN`; actionlint exit 0 | ✅ |
| CA-8 | `docs/fundacion/contexto.md` (Stack), `package.json` `db:push` intacto | `src/arch/migraciones-workflow.test.ts` › «CA-8 …» (2); `npm run gates` exit 0 en Linux (abajo) | `npm run gates` en `playwright:v1.63.0-noble` sobre el export LF de `ae99d44`: tsc ok, biome 316 ficheros 1 aviso previo, 112 ficheros / 2061 tests pasan (3 omitidos), `next build` ok, exit 0. `db:push` intacto; `contexto.md` lo dice | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-11-02 (verificación previa al merge, sdd-verificador).** El código
cumple todo lo verificable en local (CA-1, CA-7, CA-8 ✅; partes estáticas de
CA-2..CA-6 en verde), pero CA-6 no tiene la cita que exige y el handoff no
permite verificar CA-5 tal y como está escrito. Nada de código que corregir.
- **V-1 (alta).** El check `migraciones` no puede existir antes del merge (no
  hay disparador de PR y el dispatch exige el fichero en `main`), así que
  Vercel no puede retenerlo en el SHA del merge: el orden de CA-5 sobre «ese
  SHA» saldría por azar. El handoff (pasos 1 y 4) lo acepta. Corregir: tras el
  run del merge, marcar el check; CA-5 (orden) se demuestra sobre el siguiente
  commit de `main` (p. ej. la PR de evidencia), comprobando que su despliegue
  queda retenido mientras el run corre. Requiere que el arquitecto/titular
  acepte ese SHA en lugar del del merge (texto de CA-5).
- **V-2 (media).** Falta el procedimiento para desbloquear producción con el
  check en rojo. Fallos reproducidos con la CLI 2.122.0: (a) SQL roto →
  `DbPushApplyError`, deja aplicadas las migraciones previas del lote (arreglo
  hacia delante); (b) migración de rama con fecha anterior a la última aplicada
  → `DbPushMissingRemoteError` (pide `--include-all`): todo push siguiente
  rojo hasta renombrar el fichero; (c) versión en la base que no está en `main`
  (p. ej. `npm run db:push` desde una rama, la vía «de emergencia») →
  `DbPushMissingLocalError`: rojo hasta fusionar el fichero o `migration
  repair`. Documentar en `contexto.md` (o ADR-024): cómo desbloquear cada
  caso, que `db:push` solo se lanza desde `main`, y si Vercel permite promover
  a mano saltándose el check.
- **V-3 (media).** CA-6 exige «la documentación de Vercel citada en el
  ledger» (Deployment Checks retienen la promoción a producción): no está.
- **V-4 (baja).** Handoff paso 3: `--ref ft/SPEC-043-…` falla si la rama se
  borra al fusionar; usar cualquier rama existente distinta de `main`.
- **V-5 (baja).** La concurrencia de GitHub deja un solo run pendiente por
  grupo: un dispatch (incluido `dry-run` desde rama) cancela el run de `push`
  pendiente y ese SHA de `main` queda sin check verde (se arregla con el
  siguiente push o relanzando). Anotarlo en el procedimiento de V-2.
- **F-SPEC-043-1 resuelto:** `20261101120000` ya está en `origin/main` (#85) y
  en la rama; con el historial de `main` sembrado, el dry-run solo ve
  `20261102120000`.
- **Pendiente tras el merge (no verificable antes):** CA-2 run rojo real;
  CA-3 `grep -cF` sobre los logs reales; CA-4 dry-run real con `migration
  list` antes/después; CA-5 aplicación real, orden check→*Current* (según V-1)
  e idempotencia por dispatch; CA-6 captura del Deployment Check; y que el
  `DATABASE_URL` (H-3, ¿pooler en modo transacción?) sirve a la CLI.


## Evidencia del implementador
- Gates: `npm run gates` en `mcr.microsoft.com/playwright:v1.63.0-noble` sobre
  `git -c core.autocrlf=false archive HEAD` (`39c77d4`): exit 0; biome 310
  ficheros, 1 aviso previo (`src/arch/deploy.test.ts:336`); 110 ficheros de
  test, 1993 pasan, 3 omitidos; `next build` compila.
- Sondeo de la CLI (Postgres 17 local, nunca producción):
  `npx supabase@2.122.0 db push --dry-run --db-url <local>` con una versión
  remota que no está en local → exit 1, `DbPushMissingLocalError: Remote
  migration versions not found in local migrations directory.` (ver F-1). Un
  error de conexión imprime `host=… user=…` en claro: de ahí el enmascarado.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-043/. Informe HTML opcional: _qa/SPEC-043/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-043-1, F-SPEC-043-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-043-1 (bloqueante del merge, para el gate humano).** La migración
  `20261101120000_spec041_scored_at.sql` ya está aplicada en producción (H-2)
  pero no está en `main`: si esta PR se fusiona antes que la #85, `supabase db
  push` sale 1 (`DbPushMissingLocalError`, sondeo arriba), el check queda rojo
  y Vercel no promueve nada. Fusionar la #85 antes que esta (o meter el
  fichero de SPEC-041 en `main` antes). La migración de CA-5 (`20261102…`)
  ya ordena detrás de la de SPEC-041.
- **F-SPEC-043-2.** `actionlint` no admite un directorio como argumento: el
  comando de CA-1 es `actionlint` sin argumentos en la raíz (o los 4 ficheros).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Hecho y commiteado en la rama (sin push): workflow, enmascarado, dispatch del
calendario, migración inocua, contexto, tests estáticos. Falta la
verificación real, solo posible tras fusionar (y tras la #85, F-1):
1. **Antes del merge (titular):** en Vercel, Project → Settings → Build and
   Deployment → Deployment Checks, marcar `migraciones` como obligatorio de
   producción (solo aparece tras un primer run; si no aparece, marcar justo
   después del run del paso 4 y antes de dar CA-5 por buena). Captura a
   `_qa/SPEC-043/deployment-check.png`.
2. **CA-4:** `supabase migration list --db-url "$DATABASE_URL"` local >
   `antes.txt`; `gh workflow run migraciones.yml --ref main -f modo=dry-run`;
   `gh run watch <id>`; repetir `migration list` > `despues.txt`;
   `diff antes.txt despues.txt` vacío; el log dice qué está pendiente.
3. **CA-2 (run rojo):** `gh workflow run migraciones.yml --ref
   ft/SPEC-043-migraciones-automaticas-al-fusionar -f modo=aplicar` → rojo en
   «Guardia», sin pasos posteriores ejecutados (`gh run view <id>`).
4. **CA-5:** el run de `push` del merge aplica `20261102120000`; `migration
   list` la muestra; comparar la hora de fin del job (`gh run view <id> --json
   jobs`) con la de *Current* del despliegue de ese SHA (`vercel inspect`).
   Luego `gh workflow run migraciones.yml --ref main -f modo=aplicar` → verde
   con «Remote database is up to date.».
5. **CA-3:** para cada run de 2–4, `gh run view <id> --log > run.log` y contar
   sin imprimir: `node -e 'process.loadEnvFile();const u=new
   URL(process.env.DATABASE_URL),l=require("fs").readFileSync("run.log","utf8");
   for(const[k,v]of Object.entries({url:process.env.DATABASE_URL,host:u.hostname,
   user:u.username,pass:decodeURIComponent(u.password)}))console.log(k,l.split(v).length-1)'`
   → todos 0.
