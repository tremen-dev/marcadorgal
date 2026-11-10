---
id: SPEC-080
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
---
# SPEC-080 — El test de test-db usa el separador de PATH de la plataforma

## Problema
`src/db/test-db.test.ts` › «SPEC-022 CA-1 local Storage forced over the .env › wins over a .env file in the cwd too» falla en Windows local (`expected 1 to be +0` en `expect(r.status).toBe(0)`). En CI Linux pasa. La causa está en la línea 211: arma `PATH: \`${f.dir}:${process.env.PATH}\`` con `:` fijo. En Windows el separador es `;`, así que el script no encuentra el `npx` falso del directorio temporal y sale con 1. El helper `runIn` (línea 43) y la línea 167 del mismo fichero ya usan `path.delimiter`, y esos casos pasan en Windows. Por este fallo, `npm run gates` no sale con 0 en ninguna máquina Windows. SPEC-078 y SPEC-076 tuvieron que aceptarlo como salvedad. Origen: F-SPEC-076-3 (ledger de SPEC-076).

## Usuarios / roles afectados
Equipo: quien corre `npm run gates` en Windows. No afecta al público ni a producción.

## Criterios de aceptación
- **CA-1 Separador de la plataforma.** Dado el caso «wins over a .env file in the cwd too», cuando construye el `PATH` del proceso hijo, entonces usa `path.delimiter` (o reutiliza `runIn`/el patrón de la línea 167). El `it(...)` conserva sin cambios sus aserciones (`status` 0, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_TICK_TOKEN`) y su escenario (`.env` de producción en el cwd, claves de `PROD_ENV` fuera del entorno). `git diff` del bloque: solo la construcción del `PATH`.
- **CA-2 Verde en Windows y en Linux.** `npx vitest run src/db/test-db.test.ts` termina con 0 fallos en Windows local (worktree LF) y en el job `gates` del CI de Linux del PR. En el ledger van la salida de Windows (con el recuento de tests) y el id del run de CI. Antes del cambio, en Windows, el mismo comando da 1 fallo en ese caso. Esa salida también se anota.
- **CA-3 Sin otros `:` fijos.** Dada la búsqueda `git grep -nE "PATH[\"']?\s*:\s*\`" -- 'src/**/*.test.ts' 'tools/**' 'scripts/**'` (o equivalente), entonces ninguna construcción de `PATH` concatena con `:` literal. Si aparece otra, se corrige igual dentro de esta spec. En el ledger van el comando y su salida. A 5d94776 solo existe la de la línea 211.
- **CA-4 Gates y versión.** `npm run gates` → 0 en el CI del PR. En Windows local también se corre y se anota: ya no debe fallar `test-db.test.ts`, y cualquier otro fallo, si aparece, se registra como follow-up. Solo cambia `src/db/test-db.test.ts` (más otros tests si CA-3 encuentra algo) y `package*.json`. No se toca código de producción: ni `tools/`, ni `src/db` fuera de tests, ni `data/`, ni `supabase/`. La excepción sería que el diagnóstico resulte falso. En ese caso se para y se vuelve al arquitecto. Versión `patch` (ADR-028) con `npm version patch --no-git-tag-version`: 0.8.1 → 0.8.2, o la siguiente si otro PR la ocupa.

## Entidades y reglas afectadas
SPEC-022 (CA-1, script de test-db), ADR-028 (versión por PR). Origen: F-SPEC-076-3. Lo mencionan como salvedad SPEC-078 (CA-4) y SPEC-076 (CA-5).

## Fuera de alcance
- Cambiar el script que prueba el test (`tools/` / `src/db`) o su forma de resolver `npx`.
- Otras incompatibilidades de Windows en la suite, salvo los `PATH` de CA-3.
- Hacer obligatorio un job de CI en Windows.

## Notas para el gate humano
- Arreglo de una línea en un test. El riesgo está en el diagnóstico. CA-2 lo comprueba con el antes y el después en Windows. Si el caso sigue fallando con `path.delimiter`, el implementador para y no toca código de producción.
- Al cerrarla, SPEC-078 y SPEC-076 dejan de necesitar su salvedad en las specs futuras.
