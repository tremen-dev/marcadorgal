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
| CA-1 | `.github/workflows/migraciones.yml` | actionlint 1.7.7 (Docker `rhysd/actionlint:1.7.7`, shellcheck 0.10.0) sobre los 4 YAML del export LF de `39c77d4`: exit 0, sin salida | | ❌ |
| CA-2 | `.github/workflows/migraciones.yml` (paso «Guardia», env `MODO`) | `src/arch/migraciones-workflow.test.ts` › «SPEC-043 CA-2 …» (9 casos). Run rojo de la guardia: tras el merge (handoff, paso 3) | | ❌ |
| CA-3 | `migraciones.yml` (paso «Enmascarar…»), `tools/mascara-db-url.mjs` | `src/arch/migraciones-workflow.test.ts` › «CA-3 one secret, never printed» (3) y «CA-3 tools/mascara-db-url.mjs» (2). `grep -cF` de los logs: tras el merge (handoff, paso 5) | | ❌ |
| CA-4 | `migraciones.yml` (rama `--dry-run`) | Sondeo local (Postgres 17 en Docker, CLI 2.122.0): dry-run «Would push these migrations: • 20261102120000_…», exit 0. Real: tras el merge (handoff, paso 2) | | ❌ |
| CA-5 | `supabase/migrations/20261102120000_spec043_harmless_comment.sql` | `src/arch/migraciones-workflow.test.ts` › «CA-5 the harmless migration». Sondeo local: aplica y la 2.ª pasada dice «Remote database is up to date.», exit 0. Real: tras el merge (handoff, paso 4) | | ❌ |
| CA-6 | `migraciones.yml` (`defaults.run.shell: bash`, sin `continue-on-error` ni `\|\| true`) | `src/arch/migraciones-workflow.test.ts` › «CA-6 …» (2). Deployment Check en Vercel y captura `_qa/SPEC-043/`: tras el merge (handoff, paso 1) | | ❌ |
| CA-7 | `.github/workflows/calendario-semanal.yml` (paso «Fusionar y cargar…») | `src/arch/migraciones-workflow.test.ts` › «CA-7 …»; actionlint (CA-1) | | ❌ |
| CA-8 | `docs/fundacion/contexto.md` (Stack), `package.json` `db:push` intacto | `src/arch/migraciones-workflow.test.ts` › «CA-8 …» (2); `npm run gates` exit 0 en Linux (abajo) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
