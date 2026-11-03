---
id: SPEC-047
tipo: spec
epica: EPIC-MANT
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-11-03, por: sdd-arquitecto}
---
# SPEC-047 — Entorno de base local y gates en Windows

## Problema
El titular trabaja en Windows y hoy ahí no se puede verificar nada de lo vigilado:
(1) `tools/test-db.mjs`, `tools/db-push.mjs` y `playwright.db.config.ts` lanzan
`supabase`/`npx` con `spawnSync` sin shell → `ENOENT` (F-SPEC-045-4, V-3);
(2) la CLI de Supabase no está en `devDependencies`: en local corre la que haya
(`npx --no-install supabase` → 3.0.0); en CI, `migraciones.yml` fija 2.122.0;
y `db:push`, la vía de emergencia a producción (ADR-024), corre con una versión
desconocida; (3) con `core.autocrlf=true` el checkout es CRLF, y `npm run lint`
y varios tests de `src/design/` fallan también en `main` (F-SPEC-040-2);
además, `fonts.test.ts` y `no-hex.test.ts` comparan rutas de `relative()` con `\`;
(4) cosmético: `artboards.test.ts` titula «reproduce undefined.dc.html» (V-2).
Hoy todo se verifica en Linux (`playwright:v1.63.0-noble`, export LF).

## Usuarios / roles afectados
Titular; sdd-implementador y sdd-verificador (gates y suites con base en local).

## Criterios de aceptación
- **CA-1 CLI fijada y única.** `supabase` en `devDependencies` con versión
  exacta 2.122.0 (sin `^`/`~`). Un test de `src/arch/` falla si difiere del
  `version:` de `supabase/setup-cli` en `migraciones.yml`. Evidencia: el test
  en verde, y en rojo al cambiar una de las dos (salida en el ledger).
- **CA-2 Un solo resolutor del binario.** `test-db.mjs`, `db-push.mjs` y
  `playwright.db.config.ts` lanzan la CLI del proyecto (`node_modules`), nunca
  la del `PATH` ni la de la caché de npx, mediante un helper común sin
  `shell: true` (la URL va como argumento y un shell reinterpretaría `&`/`%`).
  Test unitario del helper para `win32` y `linux`. Dado que la CLI no está
  instalada, el script sale ≠0 con un mensaje que dice qué instalar, no `ENOENT`.
- **CA-3 Suites con base en Windows.** Dado Windows 11 con Docker Desktop y
  `supabase start`, cuando corren `npm run test:db` y `npm run e2e:db`, entonces
  salen 0. Evidencia: comando, versión de la CLI impresa y cola de la salida.
  El mismo par en el contenedor Linux de SPEC-045 sigue saliendo 0.
- **CA-4 `.gitattributes` LF.** `* text=auto eol=lf` más excepciones que
  conservan bytes: las `-text` actuales, `src/sources/rfef/fixtures/** -text`
  (crudo: `sin-cookie-aceptada.html` es CRLF real) y `docs/**/_qa/** -text`
  (evidencia). `git add --renormalize .` no cambia ningún fichero salvo
  `.gitattributes` (`git diff --cached --stat`); `git ls-files --eol` no muestra
  `i/crlf` ni `i/mixed` fuera de las excepciones.
- **CA-5 Gates en Windows.** Dado un clon nuevo en Windows con
  `core.autocrlf=true`, cuando corre `npm run gates`, entonces sale 0. Lo que
  falle por el separador de ruta se arregla normalizando a `/` en el test (test
  en rojo antes, en verde después). Evidencia: salida de gates en Windows y en CI.
- **CA-6 Título del artboard.** `vitest run src/design/artboards.test.ts
  --reporter verbose` lista los tres títulos con su nombre y ninguno contiene
  `undefined`.
- **CA-7 Nada se rompe fuera.** `ci` y el build de Vercel en verde en la PR;
  `migraciones.yml` sin cambios (H-1).

## Entidades y reglas afectadas
ADR-001 (stack, npm), ADR-014 §1 (`test:db` solo local), ADR-024 (`db:push`,
vía de emergencia). Ninguna RN ni entidad de dominio.

## Fuera de alcance
Subir la CLI a 3.x; `test:db`/`e2e:db` en CI (SPEC-002 N-7); cambiar
`migraciones.yml` a la CLI de `node_modules`; reescribir la historia de git;
sistemas operativos distintos de Windows 11 y Linux.

## Notas para el gate humano
- **Al implementar, partir de `main` actualizado:** la rama de SPEC-039 añade
  el script `informe:rfef` a `package.json`, y CA-1 toca el mismo fichero.
- **H-1 ¿Dónde vive la versión?** Recomiendo `devDependencies` y un test de
  igualdad con `migraciones.yml` (CA-1), sin tocar el workflow que SPEC-043
  dejó verificado en producción. Alternativa: que el workflow use la CLI de
  `node_modules`; una sola fuente, pero reabre la verificación de SPEC-043.
- **H-2 Descarga en `postinstall`.** El paquete `supabase` baja el binario de
  GitHub al instalarse: lo harán `npm ci` en CI y el build de Vercel. Riesgo: más
  tiempo y un punto de fallo externo en cada despliegue. CA-7 lo mide; si el
  build de Vercel sufre, plan B: `optionalDependencies` u omitirlo en Vercel.
- **H-3 Renormalización y worktrees vivos.** El índice ya es LF salvo las
  excepciones, así que el commit solo añade `.gitattributes`. Cada worktree de
  Windows tiene que volver a materializarse tras el merge (`git rm -r --cached .
  && git reset --hard`, sin cambios pendientes). Recomiendo fusionar cuando
  ninguna otra sesión tenga trabajo sin commitear (hoy SPEC-039/046) y anotar
  el paso en `README.md`. `core.autocrlf` local no se toca: `eol=lf` manda.
- Excluir `docs/**/_qa/**` hace que la evidencia nueva entre con CRLF desde
  Windows; es aceptable porque es registro, no código.
