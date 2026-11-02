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
| CA-1 | `.github/workflows/migraciones.yml` | actionlint 1.7.7 (Docker `rhysd/actionlint:1.7.7`, shellcheck 0.10.0) sobre los 4 YAML del export LF de `39c77d4`: exit 0, sin salida | actionlint 1.7.7 (shellcheck 0.10.0) sobre los 4 YAML del export LF de `ae99d44` y sobre el worktree: exit 0, sin salida. Iter. 2, export LF de `599206c`: exit 0, sin salida | ✅ |
| CA-2 | `.github/workflows/migraciones.yml` (paso «Guardia», env `MODO`) | `src/arch/migraciones-workflow.test.ts` › «SPEC-043 CA-2 …» (9 casos). Run rojo de la guardia: tras el merge (handoff, paso 3) | Estático: 20/20 tests verdes; YAML leído (push main sin `paths`, dispatch `modo` choice/dry-run, concurrency, `contents: read`, timeout 10, CLI 2.122.0). Guardia ejecutada en bash `-eo pipefail`: aplicar+`refs/heads/ft/…`→1, aplicar+tag→1, modo vacío/desconocido→1, aplicar+main→0, dry-run+rama→0. **Real:** run 41458903881 (dispatch aplicar, `qa/spec-043-guardia`, `00fc604`) `failure`; «Guardia — solo se aplica desde main»: failure, checkout/setup-cli/enmascarar/db push/migration list: skipped; log: `modo=aplicar solo desde refs/heads/main (pedido: refs/heads/qa/spec-043-guardia).`; `git ls-remote origin qa/spec-043-guardia` → 0 líneas | ✅ |
| CA-3 | `migraciones.yml` (paso «Enmascarar…»), `tools/mascara-db-url.mjs` | `src/arch/migraciones-workflow.test.ts` › «CA-3 one secret, never printed» (3) y «CA-3 tools/mascara-db-url.mjs» (2). `grep -cF` de los logs: tras el merge (handoff, paso 5) | Estático: único secreto, por `env`, sin `${{` en `run:`. CLI 2.122.0 real con URL errónea (auth, TLS, DNS): imprime `host=… user=…` (host 1-2, usuario 1-2 apariciones); tras aplicar las máscaras de `mascara-db-url.mjs` → url/host/user/pass/pass codificada = 0. **Real (orquestador, credencial de Vercel a fichero temporal ya borrado):** recuento sin imprimir de url/host/user/pass/pass codificada en `gh run view --log` de 41458386689, 41458689959, 41458766142, 41458903881 → 0 en todos. Pendiente: el run de `push` de CA-5 (c) | 🚧 |
| CA-4 | `migraciones.yml` (rama `--dry-run`) | Sondeo local (Postgres 17 en Docker, CLI 2.122.0): dry-run «Would push these migrations: • 20261102120000_…», exit 0. Real: tras el merge (handoff, paso 2) | Local (Postgres 17 efímero con el historial de `origin/main`, 26 versiones): `db push --dry-run` exit 0, «Would push … 20261102120000»; `migration list` antes/después idéntico (`diff` vacío). **Real:** run 41458766142 (dispatch, `MODO: dry-run`, `00fc604`) `success`; log «Remote database is up to date.»; `supabase migration list` del run y de 41458689959 (antes): 27 filas Local == Remote, idénticas; 27 ficheros en `supabase/migrations` | ✅ |
| CA-5 | `supabase/migrations/20261102120000_spec043_harmless_comment.sql` | `src/arch/migraciones-workflow.test.ts` › «CA-5 the harmless migration». Sondeo local: aplica y la 2.ª pasada dice «Remote database is up to date.», exit 0. Real, según la enmienda: (a) handoff paso 2, (b) paso 3, (c) paso 7 | Local: aplica 20261102120000 (exit 0, comentario del esquema `web` escrito); 2.ª pasada «Remote database is up to date.» exit 0. Iter. 2: CA-5 enmendado (V-1) y handoff (a) paso 2, (b) paso 3, (c) pasos 6-7 coherentes con él. **Real:** (a) run push 41458386689 (`00fc604`, merge PR #87 14:03:39Z) `success`; log «Applying migration 20261102120000_spec043_harmless_comment.sql...»; `migration list` `20261102120000` en Local y Remote. (b) run 41458689959 (dispatch aplicar, `headSha` `00fc604`, sin commits entre medias) `success`, «Remote database is up to date.». (c) **pendiente** (paso 7) | 🚧 |
| CA-6 | `migraciones.yml` (`defaults.run.shell: bash`, sin `continue-on-error` ni `\|\| true`) | `src/arch/migraciones-workflow.test.ts` › «CA-6 …» (2). Documentación de Vercel citada en «Evidencia del implementador». Deployment Check en Vercel y captura `_qa/SPEC-043/`: tras el merge (handoff, paso 6) | YAML: sin `continue-on-error` ni `\|\| true`, `defaults.run.shell: bash`. Local: `db push` con SQL roto → exit 1. Iter. 2: las 6 citas de Vercel del ledger coinciden literalmente con https://vercel.com/docs/deployment-checks (leída 2026-11-02, last_updated 2026-08-11). Captura `_qa/SPEC-043/deployment-check.png`: Settings → Build and Deployment → Deployment Checks lista `migraciones` (GitHub) con «Production» (añadido por Alberto Fojo, 2026-11-02) | ✅ |
| CA-7 | `.github/workflows/calendario-semanal.yml` (paso «Fusionar y cargar…») | `src/arch/migraciones-workflow.test.ts` › «CA-7 …»; actionlint (CA-1) | Diff de `calendario-semanal.yml`: el dispatch va tras `gh pr merge`, job con `actions: write` y `GH_TOKEN`; actionlint exit 0 | ✅ |
| CA-8 | `docs/fundacion/contexto.md` (Stack), `package.json` `db:push` intacto | `src/arch/migraciones-workflow.test.ts` › «CA-8 …» (2); `npm run gates` exit 0 en Linux (abajo) | `npm run gates` en `playwright:v1.63.0-noble` sobre el export LF de `ae99d44`: tsc ok, biome 316 ficheros 1 aviso previo, 112 ficheros / 2061 tests pasan (3 omitidos), `next build` ok, exit 0. `db:push` intacto; `contexto.md` lo dice. Iter. 2, export LF de `599206c` en el mismo contenedor: `npm run gates` (typecheck && lint && test && build) exit 0 | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**Post-merge parcial — 2026-11-02 (sdd-verificador).** Verde todo lo
ejecutado; falta CA-5 (c) y su CA-3. La spec no pasa a `hecho`.
- `gh pr view 87`: MERGED 2026-11-02T14:03:39Z, `00fc604`.
- `gh run list --workflow migraciones.yml` / `gh run view <id> --json jobs` / `--log`:

| Run | Evento · ref · SHA | Resultado | Log |
|---|---|---|---|
| 41458386689 | push · main · `00fc604` | success (14:03:47→14:04:00Z) | aplica `20261102120000`; list 27 = 27 |
| 41458689959 | dispatch aplicar · main · `00fc604` | success | «Remote database is up to date.» |
| 41458766142 | dispatch dry-run · main · `00fc604` | success | «Remote database is up to date.»; list 27 = 27 |
| 41458903881 | dispatch aplicar · `qa/spec-043-guardia` · `00fc604` | failure en Guardia; resto skipped | `modo=aplicar solo desde refs/heads/main (pedido: refs/heads/qa/spec-043-guardia).` |
| 41467941550 | push · main · `f6edf7c` (PR #88) | success (15:04:13→15:04:24Z) | «Remote database is up to date.» |
| 41489184880 | push · main · `8282501` (PR #90) | success (17:14:03→17:14:29Z) | «Remote database is up to date.» |

- **Pendiente CA-5 (c), paso 7:** sobre el merge de la PR de cierre (`$SHA2`):
  run push de `$SHA2` verde; `gh run view <id> --json jobs` → `completedAt`
  del job `migraciones`; despliegue de producción de `$SHA2` retenido mientras
  corre (`_qa/SPEC-043/retenido.png`, `vercel inspect`) y *Current* posterior a
  `completedAt`. **CA-3** de ese run: recuento (paso 8) → 0.
- **Condición (`8282501` no concluyente).** Diálogo «Add checks» en capturas
  de móvil 16:32–16:34Z, antes de `8282501` (17:13:56Z); hora de guardado
  desconocida. `vercel api /v13/deployments/dpl_3ckneGfFQySw3k3GdzcroMxf6kV7`:
  createdAt 17:13:59.764Z, ready 17:14:19.952Z, `readySubstate` PROMOTED,
  `aliasAssigned` true (sin hora), sin `checksState`/`checksConclusion`;
  `/v1/deployments/<id>/checks` → `{"checks":[]}`. Job 41489184880:
  17:14:03→17:14:29Z. Sin hora de promoción en la API.
- **Método del paso 7:** sondear `vercel api /v13/deployments/<id>` con hora
  mientras corre el run (`readySubstate` STAGED → PROMOTED tras `completedAt`;
  `checksState`) y `/v1/deployments/<id>/checks`.
- **O-4:** en la captura, la insignia «Production» de `migraciones` lleva un
  icono «i» distinto de las de Lint/TypeCheck; comprobar en el paso 7 que el
  check retiene de verdad (es lo que mide CA-5 (c)).

**GREEN previo al merge — 2026-11-02, iteración 2 (sdd-verificador).** Todo
lo verificable antes del merge cumple y lo posterior está bien preparado. La
spec sigue `en-revision` hasta la verificación posterior al merge (no pasa a
`hecho`). Solo cambiaron docs desde `497b68c`; workflow y código idénticos.
- **V-1 resuelto:** CA-5 enmendado (aceptado por el titular) y handoff (a)
  paso 2, (b) paso 3, (c) pasos 6-7 sobre el siguiente commit de `main`.
- **V-2 resuelto:** precisión fechada de ADR-024 (casos a/b/c, reglas de
  timestamp y de `db:push` solo desde `main`, escape Force Promote con la
  condición §3); `contexto.md` remite a ella.
- **V-3 resuelto:** las 6 citas coinciden literalmente con
  https://vercel.com/docs/deployment-checks (last_updated 2026-08-11), incluidos
  requisitos (Vercel for GitHub, automatic aliasing), ruta Settings → Build and
  Deployment → Deployment Checks, identificación por nombre de job y Force
  Promote.
- **V-4 resuelto:** rama efímera `qa/spec-043-guardia` desde `origin/main` (el
  fichero existe en esa ref; `push` solo dispara en `main`, así que crearla no
  lanza `migraciones` ni `calendario-semanal`), borrada al final.
- **V-5 resuelto:** anotado en ADR-024 (remedio: re-run o dispatch `aplicar`)
  y precondición explícita en el paso 5.
- **Handoff revisado:** orden correcto (2 → 3 sin commits intermedios → 4 con
  la base al día → 5 → 6 → 7 → 8); `gh run list --commit/--event/--branch`,
  `gh run view --json headSha,conclusion,jobs` y `--log` existen (gh 2.83.1).
  El orden 5 antes de 6 es necesario: el run rojo de la guardia deja un check
  `migraciones` rojo sobre el SHA de cabeza de `main`; antes de marcar el
  Deployment Check no retiene nada y ese SHA ya es *Current*. No invertirlo.
- **Observaciones (no bloquean):** O-1: ADR-024 «Deciders» aún dice
  «Pendiente de su aprobación» con `estado: aprobada` (al arquitecto). O-2:
  las capturas de `$SHA2` (paso 7) y los recuentos del paso 8 no pueden ir en
  el propio commit `$SHA2`: la evidencia entra en un commit posterior. O-3: la
  rama efímera generará un preview de Vercel (inocuo).
- Evidencia: actionlint 1.7.7 sobre los 4 YAML del export LF de `599206c`
  exit 0 sin salida; `npm run gates` en `playwright:v1.63.0-noble` exit 0.

**Iteración 1 (histórico):**
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
- Documentación de Vercel (CA-6, V-3), leída el 2026-11-02 en
  https://vercel.com/docs/deployment-checks (last_updated 2026-08-11):
  - «When you add Deployment Checks to a project, Vercel will hold each
    production deployment until all required checks pass before assigning it
    to your custom production domains.»
  - «Production deployments will still be created, but will not be
    automatically assigned to your custom domains until all Deployment Checks
    are met.»
  - «Once all of the Deployment Checks have passed, the deployment is aliased
    to your production domain(s) automatically.»
  - Configuración: Project → Settings → Build and Deployment → Deployment
    Checks → «Add Checks» → proveedor **GitHub**. Requisitos: proyecto
    enlazado con Vercel for GitHub y «automatic aliasing for production»
    activado en Settings → Environments → Production.
  - Identificación: «GitHub uses the names of jobs to identify which checks are
    the same across instances»: el check es el job `migraciones`; renombrarlo
    obliga a actualizar el Deployment Check.
  - Escape: «You can bypass Deployment Checks by selecting Force Promote from
    the deployment details page» (ADR-024, precisión).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-043/. Informe HTML opcional: _qa/SPEC-043/informe.html -->
| CA | Captura |
|---|---|
| CA-6 | `_qa/SPEC-043/deployment-check.png` (Deployment Checks: `migraciones` · GitHub · Production) |
| CA-5 (c) | `_qa/SPEC-043/retenido.png` — pendiente (paso 7) |

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
calendario, migración inocua, contexto (con la regla «`db:push` solo desde
`main`» y remisión a la precisión de ADR-024), tests estáticos, cita de Vercel
(CA-6). Falta la verificación real, solo posible tras fusionar. Orden según el
CA-5 enmendado; `$SHA` es el SHA del merge de esta PR en `main`.
**Estado 2026-11-02:** pasos 1-6 hechos (`$SHA` = `00fc604`; evidencia en el
veredicto); 8 hecho para los runs de 2-5. Faltan 7 y 8 para el run de 7.
1. **Antes del merge (titular).** #85 ya en `main` (F-1). En Vercel: proyecto
   enlazado con Vercel for GitHub y Settings → Environments → Production con
   «automatic aliasing» activo. El check `migraciones` aún no existe: no se
   marca ahora (paso 6).
2. **CA-5 (a).** Fusionar. `gh run list --workflow migraciones.yml --event
   push --commit $SHA` → id; `gh run watch <id>` verde; el log de «supabase
   db push» aplica `20261102120000`; `supabase migration list --db-url
   "$DATABASE_URL"` (local, `.env`) la muestra en remoto.
3. **CA-5 (b).** Sin otro commit en `main` entre medias:
   `gh workflow run migraciones.yml --ref main -f modo=aplicar`; `gh run view
   <id> --json headSha,conclusion` → `headSha` = `$SHA`, `success`; el log dice
   «Remote database is up to date.».
4. **CA-4.** `supabase migration list --db-url "$DATABASE_URL" > antes.txt`;
   `gh workflow run migraciones.yml --ref main -f modo=dry-run`; `gh run watch
   <id>` verde, el log dice que está al día; `… > despues.txt`; `diff antes.txt
   despues.txt` vacío.
5. **CA-2 (run rojo), ref efímera.** Con ningún run de `migraciones` en curso
   ni pendiente (V-5):
   `git fetch origin main && git push origin origin/main:refs/heads/qa/spec-043-guardia`;
   `gh workflow run migraciones.yml --ref qa/spec-043-guardia -f modo=aplicar`;
   `gh run list --workflow migraciones.yml --branch qa/spec-043-guardia` → id;
   `gh run view <id>` → rojo en «Guardia — solo se aplica desde main», checkout
   y pasos siguientes sin ejecutar; después
   `git push origin --delete qa/spec-043-guardia`.
6. **Deployment Check (CA-6).** Project → Settings → Build and Deployment →
   Deployment Checks → Add Checks → GitHub → `migraciones` (nombre del job),
   obligatorio en producción. Captura a `_qa/SPEC-043/deployment-check.png`.
7. **CA-5 (c).** Siguiente commit de `main` (p. ej. la PR de evidencia), SHA
   `$SHA2`. Mientras el run de `push` corre: captura del despliegue de
   producción de `$SHA2` retenido (`_qa/SPEC-043/retenido.png`) y `vercel
   inspect <url>`. Al terminar: `gh run view <id> --json jobs` (`completedAt`
   del job `migraciones`, verde) frente a la hora en que el despliegue pasa a
   *Current* (panel o `vercel inspect`): *Current* posterior a `completedAt`.
8. **CA-3.** Para cada run de 2, 3, 4, 5 y 7: `gh run view <id> --log >
   run.log` y contar sin imprimir: `node -e 'process.loadEnvFile();const u=new
   URL(process.env.DATABASE_URL),l=require("fs").readFileSync("run.log","utf8");
   for(const[k,v]of Object.entries({url:process.env.DATABASE_URL,host:u.hostname,
   user:u.username,pass:decodeURIComponent(u.password)}))console.log(k,l.split(v).length-1)'`
   → todos 0.
