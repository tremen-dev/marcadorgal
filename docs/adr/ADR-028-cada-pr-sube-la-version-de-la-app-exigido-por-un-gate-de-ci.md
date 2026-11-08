---
id: ADR-028
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
---
# ADR-028: Cada PR sube la versión de la app, exigido por un gate de CI

- Deciders: el titular (Alberto Fojo) decide la regla («cada PR debe
  incrementar la versión, mediante un gate en CI»; sin bump automático ni
  versión derivada en build). sdd-arquitecto propone la mecánica el
  2026-11-08. Pendiente de aprobación.
- Specs relacionadas: SPEC-063 lo implementa. SPEC-058 consume la versión.

## Contexto
`package.json` es la única fuente de la versión; `src/lib/version.ts` la lee y
el footer la muestra con el SHA (SPEC-058). Nada obliga a subirla, así que
versiones iguales nombran builds distintos. Los PR se fusionan con merge
commit; el bot de `calendario-semanal.yml` abre y fusiona su propio PR con
`GITHUB_TOKEN`.

## Decisión
1. **Todo PR a `main` sube `version` estrictamente** (semver
   `MAJOR.MINOR.PATCH`, sin prerelease) y deja `package-lock.json` coherente.
   Se sube a mano con `npm version <patch|minor> --no-git-tag-version`.
2. **Convención**: `patch` para fix/chore/docs/test/refactor, `minor` para
   feat, `major` solo por decisión del titular.
3. **Un job `version` de CI lo exige** en `pull_request` y lo vigila en `push`
   a `main` (detector de PR fusionados con un verde viejo).
4. **Exentos los cambios que solo tocan `data/calendario/**` y
   `data/alias/**`**: son datos, no una versión de la app, y es el perímetro
   con el que el bot ya se fusiona solo (SPEC-015 CA-4).

## Consecuencias
### Positivas
- Cada build de producción con código nuevo enseña una versión nueva.
- Sin escrituras automáticas en `main`: el historial lo firma quien fusiona.
### Negativas / follow-ups
- PR concurrentes chocan por la misma versión; el segundo debe rebasar y
  volver a subir. Sin «require up to date» el choque solo se ve en `main`.
- Hacer `version` check obligatorio exige bypass para GitHub Actions o rompe
  la fusión automática del calendario (acción humana, fuera de esta decisión).

## Alternativas consideradas
- **Bump automático al fusionar (bot o action en `main`)**: rechazada por el
  titular; además escribe en `main` y compite con los PR humanos.
- **Versión derivada en build (fecha, nº de commits)**: rechazada por el
  titular; desliga la versión del repo.
- **Que el bot del calendario también suba versión**: compite con los PR
  humanos por el mismo número y versiona datos, no la app.
- **Eximir por rama o autor del bot**: más frágil que por diff; un commit
  humano en `chore/calendario` se colaría sin bump.
