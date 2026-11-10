---
id: SPEC-078
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-10, por: sdd-verificador}
---
# SPEC-078 — El test de SPEC-069 no depende del calendario vivo

## Problema
`main` está en rojo desde cdaad54 (bot del calendario, PR 125): falla `src/sources/rfef/explorer.test.ts` › «SPEC-069 … CA-2 all its observations come out…». El bot movió Las Palmas–Eldense (Segunda, J13) de `2026-11-08T17:30Z` a `2026-11-09T19:30Z`. Contra el kickoff nuevo, la fila del fixture `export-2026-11-09-proveedores.json` ya no sale como `skipped` `ambiguous_state`, sino como observación `live`. La causa: el test construye `calendar` (líneas 33–56) leyendo `data/calendario/2026-27/*.json`, que el bot reescribe solo (SPEC-015, ADR-031). Cualquier sincronización futura puede volver a romper este o cualquier otro caso del fichero. CI de PR 42834624486: 1 fallo, el mismo. Bloquea `npm run gates` en todos los PR, entre ellos el de SPEC-076. El PR del bot no lo detectó porque su CI murió en 1 s por un problema del workflow (run 42821507457).

## Usuarios / roles afectados
Equipo (CI y todos los PR). Al público no le afecta: la regresión es del test, no del adaptador.

## Criterios de aceptación
- **CA-1 Calendario y alias congelados.** Dado `explorer.test.ts`, cuando construye el calendario declarado y el alias de la temporada, entonces los lee de copias propias en `src/sources/rfef/fixtures/`, tomadas en **197ee71** (el último `main` verde). El calendario sale de los cinco ficheros de `data/calendario/2026-27/` (p. ej. `calendario-2026-27/<competición>.json`). El alias sale de `data/alias/2026-27/rfef.json` (p. ej. `alias-2026-27-rfef.json`). El README de `fixtures/` dice el origen y el commit de cada copia. Test estructural (en `explorer.test.ts` o en `src/arch/`): el fichero no contiene ni `data/calendario` ni `data/alias`.
- **CA-2 Intención de SPEC-069 intacta.** El caso «CA-2 all its observations come out…» conserva todas sus aserciones sin tocarlas: sin `requestErrors`, mismo resultado con y sin `liveProvider`, Sabadell–Real Sociedad B `live` (0-0, 45', descanso), Las Palmas–Eldense `skipped` `ambiguous_state` frente a su kickoff declarado del 11-08, y la fila de Liga F `unknown_match`. El comentario explica que ese kickoff viene del calendario congelado. `git diff` de ese bloque `it(...)`: solo el comentario.
- **CA-3 Inmune al bot (demostrado).** Dado un cambio en `data/calendario/2026-27/segunda-division.json` (el kickoff de Las Palmas–Eldense J13 a otra fecha, o el fichero vaciado de partidos) y otro en `data/alias/2026-27/rfef.json` (una entrada usada por el fixture, borrada o cambiada), cuando corre `npx vitest run src/sources/rfef/explorer.test.ts`, entonces pasan todos los casos. En el ledger: comando, cambios aplicados, salida y `git checkout` de los ficheros. El resto del fichero también pasa con el calendario actual de `main`, sin cambiar ninguna expectativa salvo la de CA-2.
- **CA-4 Gates y versión.** `npm run gates` → 0. El único fallo tolerado es `src/db/test-db.test.ts` «wins over a .env file in the cwd too» en Windows local, que en CI Linux pasa (run 42812274857: 11/11). Hay que anotarlo si aparece. Cambios solo en `src/sources/rfef/explorer.test.ts`, `src/sources/rfef/fixtures/**` y, si hace falta, un test de `src/arch/`. Nada en `src/` de producción, `data/` ni `supabase/`. Versión `patch` (ADR-028): 0.5.7 → 0.5.8, o la siguiente si otro PR la ocupa.

## Entidades y reglas afectadas
SPEC-069 (CA-2), SPEC-015 / ADR-031 (bot del calendario), ADR-008 §8 (el núcleo inyecta el calendario declarado), ADR-028. Regla de la casa: los tests de fuentes corren contra fixtures del repo.

## Fuera de alcance
- Las demás suites que leen `data/calendario/**` o `data/alias/**` en vivo: `src/sources/rfef/adapter.test.ts`, `alias.test.ts`, `src/calendar/sync-rfef.test.ts`, `src/social/text.test.ts` y los de `src/arch/` (F-SPEC-078-1). Algunas comprueban el propio dato a propósito (`calendar/data.test.ts`).
- Arreglar el CI de los PR del bot (run 42821507457, «workflow file issue»). Por eso entró este rojo sin aviso (F-SPEC-078-2).
- `src/db/test-db.test.ts` en Windows.

## Notas para el gate humano
- **Congelar en vez de corregir la expectativa.** Cambiar `skipped` por `live` volvería a romperse con la siguiente sincronización. Congelar fija el escenario que SPEC-069 describió (partido aplazado el 11-08 y jugado el 11-09). El coste: unos 244 KB de fixtures duplicados. El implementador puede recortarlos a los partidos que usa el fichero, pero copiarlos enteros es más simple y más difícil de equivocar.
- **Alias congelado también.** El titular lo decidió en el gate (2026-11-10): CA-1 y CA-3 lo incluyen.
- El rojo de `main` entró porque el CI del PR del bot no corrió los gates. Merece spec propia, y pronto.
