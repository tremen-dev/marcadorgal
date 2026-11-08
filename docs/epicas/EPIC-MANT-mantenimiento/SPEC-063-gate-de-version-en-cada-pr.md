---
id: SPEC-063
tipo: spec
epica: EPIC-MANT
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-08, por: sdd-implementador}
---
# SPEC-063 — Gate de versión en cada PR

## Problema
La versión de `package.json` (hoy `0.2.0`) sale en el footer (`v0.2.0·<sha7>`,
SPEC-058) pero solo sube cuando alguien se acuerda: dos despliegues distintos
enseñan la misma versión. Decisión del titular: cada PR sube la versión y un
gate de CI lo exige. Sin bump automático, sin bot que escriba en `main`, sin
versión derivada en build. Decisión registrada en ADR-028.

## Usuarios / roles afectados
Titular y sdd-implementador (suben la versión en cada PR); sdd-verificador (un
check más); el bot de `calendario-semanal.yml` (exento, CA-3).

## Criterios de aceptación
- **CA-1 Comparación pura.** `src/lib/version-bump.ts` exporta una función pura
  (sin `fs`, sin `git`, sin red) que recibe versión base y versión head y
  devuelve aprobado o un motivo (`invalid-base`, `invalid-head`, `not-greater`).
  Solo acepta `MAJOR.MINOR.PATCH` numérico sin ceros a la izquierda; prerelease
  (`0.3.0-rc.1`) y build (`+abc`) son inválidos. Dado
  `src/lib/version-bump.test.ts`, cuando corre Vitest, entonces cubre y pasa:
  sube patch, minor y major (aprobado); igual, menor en patch, menor en minor
  con patch mayor (`0.2.9`→`0.1.10`) (`not-greater`); comparación numérica y no
  léxica (`0.2.9`→`0.2.10` aprobado); prerelease, `v0.2.1`, `0.2`, `01.2.3` y
  cadena vacía (inválido, en base y en head).
- **CA-2 Lockfile coherente.** La misma pieza expone una función pura que,
  dados `package.json` y `package-lock.json` ya parseados, falla si `version` y
  `packages[""].version` del lock no son iguales a `version` de `package.json`.
  Test en el mismo fichero: coherente, lock raíz desfasado, `packages[""]`
  desfasado. (Comprobado el 2026-11-08: `npm version patch
  --no-git-tag-version` sobre copias de ambos ficheros deja los tres campos en
  `0.2.1`.)
- **CA-3 Exención del calendario.** Función pura que, dada la lista de rutas
  cambiadas, responde exento solo si la lista no está vacía y **todas** caen en
  `data/calendario/**` o `data/alias/**`. Test: solo calendario, solo alias,
  ambos (exento); calendario + `src/x.ts`, calendario + `package.json`, lista
  vacía (no exento).
- **CA-4 CLI.** `tools/version-gate.mjs --base <ref>` (importa el `.ts` como el
  resto de `tools/`) lee la versión base con `git show <ref>:package.json`, la
  head y el lock del árbol de trabajo, y las rutas con
  `git diff --name-only <ref> HEAD`. Exento → sale 0 y lo dice. Sin bump →
  sale 1 con un mensaje en castellano que contiene la versión base, la head y
  las líneas `npm version patch --no-git-tag-version` y
  `npm version minor --no-git-tag-version`. Lock incoherente → sale 1 diciendo
  qué campo difiere. Evidencia en el ledger: tres ejecuciones locales (sin
  bump, con bump, rama solo-calendario) con su salida y código.
- **CA-5 Job en CI.** `.github/workflows/ci.yml` tiene un job `version`
  (`fetch-depth: 0`, Node vía `.nvmrc`, `timeout-minutes` ≤ 5): en
  `pull_request` corre la CLI con `--base origin/${{ github.base_ref }}`; en
  `push` a `main`, con `--base ${{ github.event.before }}` (detector de la
  carrera, ver notas). Sin `continue-on-error` ni `|| true`. `actionlint`
  (versión en el ledger) sobre `.github/workflows/` sale 0.
- **CA-6 Convención escrita.** (a) `CLAUDE.md`, viñeta **Gates**: cada PR sube
  la versión; `patch` para fix/chore/docs/test/refactor, `minor` para feat,
  `major` solo por decisión del titular; el comando; exención del calendario.
  (b) Nuevo `.github/pull_request_template.md` con una casilla «Versión subida
  (patch/minor) con `npm version … --no-git-tag-version`». Verificación:
  lectura de ambos ficheros.
- **CA-7 Se aplica a sí misma.** La PR de esta spec es `chore`: sube `0.2.0` →
  `0.2.1` en `package.json` y `package-lock.json`, y su job `version` sale verde
  (enlace al run en el ledger). `npm run gates` sale 0.

## Entidades y reglas afectadas
ADR-028 (esta decisión). SPEC-058 (`APP_VERSION`, footer; no cambia).
SPEC-015 CA-4 (fusión automática del calendario; no cambia). Fronteras de
CLAUDE.md: la lógica va en `src/lib/`, no en `src/decide/` (que es dominio).

## Fuera de alcance
Bump automático, bot de versiones, tags o releases de git, CHANGELOG, derivar
la versión en build, validar que el tipo de bump case con el título del PR.

## Notas para el gate humano
- **Bot del calendario (decisión).** Su PR lo abre `GITHUB_TOKEN`, que no
  dispara `pull_request`: hoy el gate ni corre sobre él. CA-3 lo exime por
  diff (no por rama ni autor) porque es exactamente la condición con la que el
  bot ya se fusiona solo, y cubre el día que un humano empuje a
  `chore/calendario`: si ese push toca algo más que datos, pide bump como
  cualquier PR. Que el bot suba versión competiría con los PR humanos.
- **Carrera aceptada.** Dos PR abiertos que piden `0.2.1`: el segundo queda
  rojo **solo si su CI se vuelve a ejecutar** tras actualizar su base (GitHub
  no relanza `pull_request` cuando cambia la base). Sin protección de rama el
  segundo puede fusionarse con un verde viejo; entonces el run de `push` en
  `main` (CA-5) sale rojo y la siguiente PR sube la versión. Solución completa:
  check obligatorio + «Require branches to be up to date».
- **Paso manual, no CA.** `main` no tiene protección hoy (`gh api …/branches/
  main/protection` → 404). Marcar `version` como required rompe la fusión
  automática del bot (su PR nunca recibe el check). Si se marca, hace falta un
  ruleset con bypass para GitHub Actions. Ver pregunta abierta.
- Mensajes del gate en castellano (son para quien desarrolla, no público).
