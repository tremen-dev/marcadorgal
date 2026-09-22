---
id: SPEC-010
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-010 Salud del tick sin falsos fallos y retirada de medir-directo

## Resumen
- Fase: hecho (seis CA verificados el 2026-09-22 por sdd-verificador: GREEN)
- Rama: `ft/EPIC-MANT-salud-running-y-medir-directo` (la spec se escribió sobre esta rama, ya creada desde `origin/main` en el commit `2d6c3f2`, en vez de sobre `ft/SPEC-010-…`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/constants.ts` (`SALUD_IN_FLIGHT_STATUSES`, los cuatro de pg_cron, junto a las otras `SALUD_*`) · `src/ingest/salud.ts` (`inFlight`, `terminal`, `failed` sobre lo terminal) | `src/ingest/salud.test.ts` «treats the four non terminal pg_cron statuses as in flight, not as failures» y «an unknown status is not in flight, so it stays red» | Leído: la regla es `SALUD_IN_FLIGHT_STATUSES.includes(status)` y el fallo sigue siendo `status !== "succeeded"` sobre lo terminal → lista de EN VUELO, no lista de FALLO. Mutación V-3 (escribirla como `status === "failed"`) rompe el caso del estado desconocido: el `exploded` sale rojo. Informe real de los cuatro estados y del desconocido, abajo | ✅ |
| CA-2 | `src/ingest/salud.ts` (`inFlightNote`, `recentTerminal`/`terminal` en las dos líneas de ventana y en `stale`) | `src/ingest/salud.test.ts` «…twenty succeeded and one running stay at 100%» (`terminales: 20`, `100%`, `en vuelo: 1`, `running: 1`) y «…a lone running with an active job is green» (`terminales: 0`, `n/a`, sin `0%`) | Informe real: `terminales: 20 · succeeded: 100% · en vuelo: 1` y, con cero terminales, `succeeded: n/a`. `byStatus` recorre `runs` sin filtrar → la `running: 1` se sigue viendo (mutación V-2, recorrerlo sobre `terminal`, rompe el caso (i)). `stale` cuenta `failed`, que ya es terminal. La aserción de `n/a` usa `not.toContain("succeeded: 0%")`, no `"0%"`: no casa dentro de `100%`. Salvedad de cobertura en F-SPEC-010-4 (el código es correcto; lo que falta es una aserción que fije el denominador) | ✅ |
| CA-3 | `src/ingest/salud.ts` (`recentRuns` sigue sin filtrar; `silent` se mide sobre él) | `src/ingest/salud.test.ts` «a run in flight is still a sign of life: a lone running with an active job is green» (sin `sin ejecuciones`) | Leído: `recentRuns` se filtra solo por tiempo y `silent = jobs.length > 0 && recentRuns.length === 0`. Mutación V-1 (aplicar `inFlight` al construir `runs`, la trampa que nombra el CA) tumba 3 casos, entre ellos este con `ok: false` y `sin ejecuciones` → el REVISAR falso por la otra puerta está fijado por test | ✅ |
| CA-4 | `src/ingest/salud.test.ts` (cinco casos nuevos en el `describe` de CA-7) | los cinco; (i) y (iii) en rojo antes del arreglo, salida abajo | Reproducido por el verificador en árbol aparte (`git archive`, sin tocar la rama): el estado de `320cd89` da **4 failed | 14 passed** con (i) en `salud.test.ts:252` y (iii) en `:309`; y el fichero de test **de la cabeza** (aserciones ya afinadas en `d1ff2e9`) contra el `salud.ts` de `origin/main` también da **4 failed | 14 passed**, así que el rojo no depende de la redacción vieja. (iv) pasaba ya, como dice el ledger. Salida abajo | ✅ |
| CA-5 | `.github/workflows/medir-directo.yml` borrado (`9e561f9`) | sin test automático a propósito: CA-6 acota el diff bajo `src/` a tres ficheros. Evidencia por comandos, abajo | Reejecutados los comandos: `git ls-files .github/workflows` → dos líneas; `ls -a .github/workflows` → solo esos dos ficheros en disco; `grep -rn "schedule" .github/workflows` → solo `calendario-semanal.yml:8`; `tools/medir-directo.mjs` con su cabecera de uso y diff vacío contra `origin/main`; `.gitignore:13` intacta; `git ls-files 'tools/medicion*'` vacío; `grep -rn medir-directo` sin más referencias al YAML (docs solo citan el `.mjs`, y `src/arch/deploy.test.ts:183` solo lee `calendario-semanal.yml`) | ✅ |
| CA-6 | — | `npm run gates` → exit 0; los tres `git diff` de abajo | `npm run gates` corrido por el verificador: **exit 0**, 44 ficheros / 549 tests, build ✓. `git diff origin/main --stat -- src/decide src/ingest/engine.ts` **vacío** (CA-10 de SPEC-009 a salvo). `git diff origin/main --name-only -- src` → exactamente los tres ficheros. `git diff origin/main --stat -- package.json package-lock.json tools supabase .gitignore` vacío: sin dependencias, sin scripts, sin migraciones, sin tocar `tools/tick-salud.mjs`. Extra no exigido: `npm run tick:salud` contra la base del proyecto sale `OK` con el formato nuevo | ✅ |

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

### Verificación independiente (sdd-verificador, 2026-09-22)
El rojo previo se reprodujo **sin tocar la rama**: `git archive` del árbol en un
directorio aparte con `node_modules` enlazado, dos veces.

```
# (a) el estado tal cual de 320cd89 (tests puestos, arreglo sin hacer)
$ npx vitest run src/ingest/salud.test.ts
 FAIL  … > does not count a run in flight as a failure: twenty succeeded and one running stay at 100%
   AssertionError: expected false to be true     salud.test.ts:252
 FAIL  … > a run in flight is still a sign of life: a lone running with an active job is green
 FAIL  … > treats the four non terminal pg_cron statuses as in flight, not as failures
 FAIL  … > does not hide a real failure sharing the short window with a run in flight
   AssertionError: expected [ …(2) ] to have a length of 1 but got 2   salud.test.ts:309
 Tests  4 failed | 14 passed (18)

# (b) el fichero de test de HEAD (aserciones de d1ff2e9) contra el salud.ts de origin/main
$ npx vitest run src/ingest/salud.test.ts
 Tests  4 failed | 14 passed (18)      # los mismos cuatro
```
Y el arreglo no es un test complaciente: cinco mutaciones sobre el árbol de
HEAD, también en copia aparte.

| Mutación | Efecto | Tests |
|---|---|---|
| V-1 `runs` se filtra con `!inFlight` al construirse (la trampa de CA-3) | el silencio se mide sobre lo terminal | 3 failed |
| V-2 `byStatus` recorre `terminal` en vez de `runs` | la fila en vuelo deja de verse | 1 failed |
| V-3 el fallo se escribe `status === "failed"` | un estado desconocido saldría verde | 1 failed |
| V-4 el porcentaje se calcula sobre `recentRuns` | denominador con las en vuelo | **0 failed** → F-SPEC-010-4 |
| V-5 `inFlightNote` siempre vacía | no nombra las en vuelo | 1 failed |

Informe real de los cuatro casos del CA (función pura, filas fijas):
```
(i)   20 succeeded + 1 running  → ok=true
      ejecuciones (últimos 10 min): 21 · terminales: 20 · succeeded: 100% · en vuelo: 1   ← decide el semáforo
        succeeded: 20
        running: 1
      OK
(ii)  una running sola          → ok=true
      ejecuciones (últimos 10 min): 1 · terminales: 0 · succeeded: n/a · en vuelo: 1   ← decide el semáforo
      OK                                     (sin «sin ejecuciones»)
(iii) failed + running          → ok=false
      ejecuciones (últimos 10 min): 2 · terminales: 1 · succeeded: 0% · en vuelo: 1   ← decide el semáforo
        FALLO  2026-09-25T18:37:00.000Z  ingest-tick  failed      (una sola línea)
(iv)  estado «exploded»         → ok=false, FALLO … ingest-tick  exploded
```

Flujo real, no exigido por ningún CA (`npm run tick:salud` contra la base del
proyecto, 2026-09-22T15:09:42Z):
```
ejecuciones (últimos 10 min): 20  ·  terminales: 20  ·  succeeded: 100%   ← decide el semáforo
ejecuciones (última hora): 120  ·  terminales: 120  ·  succeeded: 100%
OK
```

### Cierre de F-SPEC-010-3: los estados que existen de verdad
Consulta de lectura contra la base del proyecto (la del tick desplegado),
2026-09-22:
```
$ select distinct status, count(*) from cron.job_run_details group by status order by 2 desc;
succeeded   1997
failed       217
$ select min(start_time), max(start_time), count(*) from cron.job_run_details;
2026-09-21T20:38:28Z → 2026-09-22T15:05:50Z · 2214 filas · pg_cron 1.6.4
```
**No aparece ningún estado no terminal que falte en `SALUD_IN_FLIGHT_STATUSES`**,
ni ninguno desconocido: la lista no tiene agujeros observables. Tampoco se pudo
observar ninguno *presente*: 353 consultas en 35 s de
`where end_time is null` no pillaron una sola fila en vuelo, y la razón está
medida: una ejecución dura **6,4 ms de media (p95 23 ms, máx 106 ms)** sobre 720
ejecuciones de las últimas 6 h, así que con la cadencia de 30 s la fracción de
tiempo en vuelo es ~0,02 % (≈1 mirada de cada 4.700). Ver F-SPEC-010-5.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-09-22, sdd-verificador.** Los seis CA verificados sobre
artefactos: `npm run gates` en exit 0 (549 tests), el arreglo escrito por lista
de EN VUELO y no por lista de FALLO (un estado desconocido sigue saliendo rojo),
el silencio medido sobre las filas recientes sin filtrar (CA-3 no se ha abierto
por la puerta de atrás), la fila en vuelo fuera del conteo pero dentro del
bloque de estados, `medir-directo.yml` fuera con `tools/medir-directo.mjs`
intacto, y la frontera de `src/decide` + `src/ingest/engine.ts` sin un solo
cambio contra `origin/main`. El rojo previo de CA-4 se reprodujo en árbol aparte
con las aserciones de la cabeza: cuatro caídas, (i) y (iii) incluidas. Cinco
mutaciones confirman que los casos muerden, salvo la del denominador del
porcentaje (F-SPEC-010-4, cobertura, no defecto). Sin salvedades bloqueantes.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-010/. Informe HTML opcional: _qa/SPEC-010/informe.html -->
n-a: la spec no toca interfaz. La evidencia es textual (salidas de arriba) y no
hay nada que capturar con Playwright.

## Salvedades / follow-ups
<!-- IDs F-SPEC-010-1, F-SPEC-010-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-010-1 — `docs/tablero.md` sigue diciendo que SPEC-010 está en
  `borrador`.** Es generado y no lo edita el implementador. Modo de fallo: quien
  mire el tablero esta semana cree que la spec no está aprobada. Destino:
  `/sdd-tablero` (sdd-documentalista) al cerrar.
  **→ resuelto por sdd-documentalista:** tablero regenerado con el script del
  núcleo, SPEC-010 ahora muestra estado `hecho` con fecha 2026-09-22 del
  verificador.
- **F-SPEC-010-2 — `_epica.md` lista M-8 (el workflow) como pendiente.** Esta
  spec lo resuelve, pero el texto de la épica no lo dice y la épica es de
  producto/arquitecto, no mía. Modo de fallo: M-8 se vuelve a especificar. Destino:
  la próxima pasada sobre EPIC-MANT, junto a H-3 (la épica sigue en `borrador`).
  **→ matiz del verificador: el texto sí lo dice** («**→ especificado en
  SPEC-010**», en M-6 y en M-8, commit `e0c9984`); lo que queda es que ambos
  siguen colgando del apartado «Pendientes de especificar». Riesgo real: bajo.
- **F-SPEC-010-3 — el semáforo no tiene cobertura sobre datos reales de
  `cron.job_run_details`.** Todo el arreglo está probado con filas fijas (N-1) y
  la lista de estados no terminales es la documentada de pg_cron, no una
  observada en prod. Modo de fallo: pg_cron 1.6.4 en Supabase usa un quinto
  estado no terminal que no conocemos y el viernes sale un rojo falso más raro y
  más difícil de leer que el de hoy (saldría con su nombre en la línea `FALLO`,
  que es la dirección conservadora). Mitigación barata: mirar
  `select distinct status from cron.job_run_details` una vez antes del viernes.
  Destino: R-SPEC-010-1, la próxima spec que toque el semáforo.
  **→ mitigación hecha por el verificador el 2026-09-22: en la base del proyecto
  solo existen `succeeded` (1997) y `failed` (217) sobre 2214 filas, pg_cron
  1.6.4. Ningún estado no terminal desconocido, así que la lista no tiene
  agujeros. Queda abierto el otro lado: tampoco se observó ningún estado en
  vuelo (F-SPEC-010-5).**
- **F-SPEC-010-4 (verificador) — ningún test fija el *denominador* del
  porcentaje.** Calcularlo sobre `recentRuns` en vez de sobre `recentTerminal`
  pasa los 18 tests: en el caso (i) el numerador compensa (21/21 = 100 %) y el
  caso (iii), que es donde los dos denominadores discrepan (0 % correcto frente a
  50 % mutado), no asserta el porcentaje. **El código es correcto** —verificado
  en la salida real de (iii): `terminales: 1 · succeeded: 0%`—; lo que falta es
  la aserción que lo sujete. Modo de fallo: un refactor futuro mueve el
  denominador y ningún test se queja, y el semáforo vuelve a contar las en vuelo
  como éxitos. Arreglo: una línea en el caso (iii),
  `expect(report.text).toContain("terminales: 1  ·  succeeded: 0%")`. Destino:
  R-SPEC-010-1, la próxima spec que toque el semáforo.
- **F-SPEC-010-5 (verificador) — la frecuencia del fallo que arregla esta spec es
  ~0,02 %, no «pillarla en vuelo no es teórico».** Medido en la base del
  proyecto: 720 ejecuciones de las últimas 6 h duran 6,4 ms de media (p95 23 ms,
  máx 106 ms), y 353 consultas en 35 s de `where end_time is null` no pillaron
  ninguna fila en vuelo. Con cadencia de 30 s eso es una mirada de cada ~4.700.
  El arreglo sigue siendo correcto y gratis (y necesario si algún día el tick
  tarda segundos), pero **no es cierto que el semáforo fuese a dar rojos falsos
  de forma habitual esta semana**: el Problema de la spec sobrestima el riesgo.
  Efecto secundario que sí conviene saber: no se pudo observar ningún estado no
  terminal, así que la lista de cuatro sigue siendo la documentada y no una
  observada. Destino: informativo para el titular antes del viernes 25; la
  redacción, a R-SPEC-010-1.

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
