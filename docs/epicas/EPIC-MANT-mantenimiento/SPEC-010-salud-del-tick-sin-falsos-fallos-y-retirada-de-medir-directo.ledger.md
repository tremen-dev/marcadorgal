---
id: SPEC-010
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-010 Salud del tick sin falsos fallos y retirada de medir-directo

## Resumen
- Fase: en-revision (seis CA implementados con test; pendiente de sdd-verificador)
- Rama: `ft/EPIC-MANT-salud-running-y-medir-directo` (la spec se escribió sobre esta rama, ya creada desde `origin/main` en el commit `2d6c3f2`, en vez de sobre `ft/SPEC-010-…`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/constants.ts` (`SALUD_IN_FLIGHT_STATUSES`, los cuatro de pg_cron, junto a las otras `SALUD_*`) · `src/ingest/salud.ts` (`inFlight`, `terminal`, `failed` sobre lo terminal) | `src/ingest/salud.test.ts` «treats the four non terminal pg_cron statuses as in flight, not as failures» y «an unknown status is not in flight, so it stays red» | | 🚧 |
| CA-2 | `src/ingest/salud.ts` (`inFlightNote`, `recentTerminal`/`terminal` en las dos líneas de ventana y en `stale`) | `src/ingest/salud.test.ts` «…twenty succeeded and one running stay at 100%» (`terminales: 20`, `100%`, `en vuelo: 1`, `running: 1`) y «…a lone running with an active job is green» (`terminales: 0`, `n/a`, sin `0%`) | | 🚧 |
| CA-3 | `src/ingest/salud.ts` (`recentRuns` sigue sin filtrar; `silent` se mide sobre él) | `src/ingest/salud.test.ts` «a run in flight is still a sign of life: a lone running with an active job is green» (sin `sin ejecuciones`) | | 🚧 |
| CA-4 | `src/ingest/salud.test.ts` (cinco casos nuevos en el `describe` de CA-7) | los cinco; (i) y (iii) en rojo antes del arreglo, salida abajo | | 🚧 |
| CA-5 | `.github/workflows/medir-directo.yml` borrado (`9e561f9`) | sin test automático a propósito: CA-6 acota el diff bajo `src/` a tres ficheros. Evidencia por comandos, abajo | | 🚧 |
| CA-6 | — | `npm run gates` → exit 0; los tres `git diff` de abajo | | 🚧 |

### Evidencia de CA-4: los casos muerden antes del arreglo
`npx vitest run src/ingest/salud.test.ts` en `320cd89` (tests puestos, `salud.ts`
todavía sin tocar) → **4 failed | 14 passed**:

```
 FAIL  … > does not count a run in flight as a failure: twenty succeeded and one running stay at 100%
AssertionError: expected false to be true // Object.is equality
 ❯ src/ingest/salud.test.ts:252:23   expect(report.ok).toBe(true);

 FAIL  … > does not hide a real failure sharing the short window with a run in flight
AssertionError: expected [ …(2) ] to have a length of 1 but got 2
 ❯ src/ingest/salud.test.ts:309:19   expect(lines).toHaveLength(1);
```
Es el REVISAR falso de M-6 (i) y la segunda línea `FALLO`, la de la `running`,
que el arreglo tenía que quitar sin tapar la `failed` (iii). También caían (ii)
y el caso de los cuatro estados. (iv) ya pasaba: es la guarda de que la regla se
escriba por lista de en vuelo y no por lista de fallo.

Tras el arreglo (`c11cf16`): **18 passed (18)**. La línea que decide el semáforo,
con veinte `succeeded` y una `running`:
```
ejecuciones (últimos 10 min): 21  ·  terminales: 20  ·  succeeded: 100%  ·  en vuelo: 1   ← decide el semáforo
  succeeded: 20
  running: 1
…
OK
```

### Evidencia de CA-5 y CA-6
```
$ git ls-files .github/workflows
.github/workflows/calendario-semanal.yml
.github/workflows/ci.yml
$ grep -rn "cron:" .github/workflows
.github/workflows/calendario-semanal.yml:11:    - cron: '0 5 * * 2'
$ git ls-files 'tools/medicion*'          # vacío, y sigue ignorado en .gitignore:13
$ npm run gates                            # EXIT=0 · 44 ficheros, 549 tests
$ git diff origin/main --stat -- src/decide src/ingest/engine.ts   # vacío
$ git diff origin/main --name-only -- src
src/ingest/constants.ts
src/ingest/salud.test.ts
src/ingest/salud.ts
$ git diff origin/main --stat -- package.json tools supabase       # vacío
```

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-010/. Informe HTML opcional: _qa/SPEC-010/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-010-1, F-SPEC-010-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-010-1 — `docs/tablero.md` sigue diciendo que SPEC-010 está en
  `borrador`.** Es generado y no lo edita el implementador. Modo de fallo: quien
  mire el tablero esta semana cree que la spec no está aprobada. Destino:
  `/sdd-tablero` (sdd-documentalista) al cerrar.
- **F-SPEC-010-2 — `_epica.md` lista M-8 (el workflow) como pendiente.** Esta
  spec lo resuelve, pero el texto de la épica no lo dice y la épica es de
  producto/arquitecto, no mía. Modo de fallo: M-8 se vuelve a especificar. Destino:
  la próxima pasada sobre EPIC-MANT, junto a H-3 (la épica sigue en `borrador`).
- **F-SPEC-010-3 — el semáforo no tiene cobertura sobre datos reales de
  `cron.job_run_details`.** Todo el arreglo está probado con filas fijas (N-1) y
  la lista de estados no terminales es la documentada de pg_cron, no una
  observada en prod. Modo de fallo: pg_cron 1.6.4 en Supabase usa un quinto
  estado no terminal que no conocemos y el viernes sale un rojo falso más raro y
  más difícil de leer que el de hoy (saldría con su nombre en la línea `FALLO`,
  que es la dirección conservadora). Mitigación barata: mirar
  `select distinct status from cron.job_run_details` una vez antes del viernes.
  Destino: R-SPEC-010-1, la próxima spec que toque el semáforo.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho: los seis CA.** Rama `ft/EPIC-MANT-salud-running-y-medir-directo` en el
  worktree `/Users/albertofojo/src/marcadorgal-mant`, sobre `origin/main`
  (`2d6c3f2`): `edad9af` estado, `320cd89` los tests **en rojo a propósito**,
  `c11cf16` el arreglo, `9e561f9` el borrado del workflow, `96e4e3e` este ledger
  y `d1ff2e9` una aserción de test afinada. Sin push, sin PR, sin merge.
- **Para reproducir el rojo de CA-4:** `git stash` no vale (el arreglo está
  commiteado); `git checkout 320cd89 -- src/ingest/salud.ts src/ingest/constants.ts`
  y `npx vitest run src/ingest/salud.test.ts` devuelve las 4 caídas, con
  `git checkout c11cf16 -- src/ingest` para volver.
- **Falta: verificación.** Las columnas Verif./Estado y el veredicto son del
  verificador. Todo es comprobable sin base de datos ni red: `npm run gates` y los
  `git diff` de arriba. `npm run tick:salud` contra prod sería un extra, no un
  requisito: `tools/tick-salud.mjs` no se ha tocado (N-1).
- **Ojo al orden de merge.** `src/ingest/constants.ts` es la única superficie
  compartida con la rama de SPEC-009 y el cambio es aditivo (H-4). Y quien
  verifique SPEC-009 necesita `git fetch` antes de su CA-10: con `main` local
  viejo, ese comando miente (N-3).
