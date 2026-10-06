---
id: SPEC-016
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-016 RN-02 por fuente: aplazado y suspendido sin operador

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-016-rn-02-por-fuente-aplazado-y-suspendido-sin-operador`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/reglas.md` **sin aplicar**: el hook protege-verdad lo bloquea al implementador; letra exacta en F-SPEC-016-1 | `src/arch/reglas-rn02.test.ts` (5 casos; 3 en **rojo** hasta la enmienda; en verde contra una copia enmendada en el scratchpad) | Aplicada en `63efcda` (`git diff origin/main -- docs/fundacion/reglas.md`: solo la frase y la nota fechada); `vitest run src/arch/reglas-rn02.test.ts` en verde | ✅ |
| CA-2 | `src/decide/engine.ts`: `transitionAllowed` sin la exigencia de `FEDERATION_PRIORITY` (y sin el parámetro `priority`); `settle` confirma con `agrees` (mismo estado y, si lo lleva, mismo marcador) | `src/decide/engine.test.ts`: «publishes postponed from a provider, provisional (ADR-012)» (invertido) y `describe` «SPEC-016 CA-2 …» (i)–(vi); los de `"fifty"` siguen en verde | (i)–(vi) en verde. Motor de `0a40046` en worktree → 6 rojos (los 5 de CA-2 + CA-3). `engine.test.ts` de `0a40046` contra el motor nuevo → 1 rojo, el invertido (CA-7 de SPEC-007 intacto, 60/61). Mutación `agrees`→`sameScore` → 1 rojo, (iv) postponed | ✅ |
| CA-3 | `src/decide/fixtures/sabadell-andorra-2026-10-03.ts` (319 filas de `observations` de `dev`, `read only`); `src/decide/fixtures/engine-0a40046.ts` (copia congelada del motor de `origin/main`) | `src/decide/replay.test.ts` `describe` «SPEC-016 CA-3 …»: 319 filas `postponed`; motor de main → 0 Decisions; motor de hoy → 1 `postponed` `provisional` `RN-01` a `2026-10-03T16:20:25.643Z`, sin alertas | `diff` con `git show 0a40046:src/decide/engine.ts`: solo cabecera y 3 rutas de import. Fixture contra `dev` en tx `read only` (`transaction_read_only on`): 319/319 filas, 0 discrepancias en id, `observed_at`, `received_at`, `raw_ref`, estado, fuente y marcador/minuto nulos. Sin secretos (grep de los valores de `.env`: 0) | ✅ |
| CA-4 | `src/ingest/window.ts` sin cambios | `src/ingest/window.test.ts` `describe` «SPEC-016 CA-4 …» (`postponed` y `suspended`: +125/+149 dentro, +150/+151 fuera); mutación de `window.ts` → 4 rojos, revertida | `git diff origin/main --stat -- src/ingest/window.ts` vacío; `window.test.ts` en verde contra `isInWindow` real | ✅ |
| CA-5 | sin migración; `git diff 0a40046 --stat -- src/sources supabase package.json package-lock.json` vacío | `npm run gates` → 1 solo por los 3 rojos de CA-1 (787/787 el resto); typecheck + lint + vitest `--exclude` CA-1 + build → 0, también con `env -u …`; `npm run test:db` → 0 (79/79, ver F-SPEC-016-3) | `npm run gates` → 0 (792/792, build ok). `npm run test:db` ×2 → 0 (79/79, `upToDate`, sin migraciones). `git diff origin/main --stat -- src/sources supabase package.json package-lock.json` vacío | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-10-04, sdd-verificador**, sobre `63efcda` contra `origin/main` = `0a40046`. CA-1..CA-5 ✅.
- F-SPEC-016-2: aceptado. `agrees` solo difiere de lo anterior cuando ambos marcadores son nulos (`scheduled`, `postponed`) y solo actúa con un confirmador de **otra** fuente: con una sola fuente nada cambia. Los tests de `0a40046` (SPEC-007 CA-7 incluido) pasan contra el motor nuevo salvo el invertido por ADR-012. Coherente con ADR-012 §2 (línea fechada).
- F-SPEC-016-3: ajeno a esta spec. `reconciliacion.db.test.ts` tarda 3248–3355 ms (×3) frente a 5 s de timeout, contra BD remota; la rama no toca `src/ingest` salvo `window.test.ts`. Pasó en los 2 `test:db` completos. Sigue como candidato a EPIC-MEJORA.
- No fusionar antes de que el titular lea CA-5 de SPEC-013 (lunes 5).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-016/. Informe HTML opcional: _qa/SPEC-016/informe.html -->
n-a: sin UI.

## Salvedades / follow-ups
<!-- IDs F-SPEC-016-1, F-SPEC-016-2… con destino (spec futura o EPIC-MEJORA). -->
- **R-SPEC-016-1** (hallazgo de campo del 2026-10-03; lo registra sdd-arquitecto el 2026-10-04).
  - Partido: `segunda-division-2026-27-j8-sabadell-andorra`.
  - Estado en `dev`: 319 observaciones `postponed` (`PST`, `fixture.id 1569958`), 0 Decisions y `board.status = scheduled` con kickoff `2026-10-03T16:30Z` ya pasado.
  - Evidencia: `_qa/RN-02-postponed/medicion.md`.
  - Esta spec no lo corrige: `replay:jornada --aplicar` solo corrige `finished` y la ventana ya se cerró. Se arregla solo si el partido se reprograma, porque `calendario:load` mueve el kickoff y abre la ventana otra vez.
  - Destino: **H-3 de ADR-012**, del titular. Debe resolverse antes de que EPIC-003 publique `board`.
  - Mientras siga así, el informe de la jornada del 2026-10-02/04 lo cuenta como discrepancia c2-ii (N-4 de la spec).
- **F-SPEC-016-1** (CA-1, destino sdd-arquitecto). El hook protege-verdad bloqueó la edición de `docs/fundacion/reglas.md`. Cambio exacto en el bullet de RN-02 (líneas 15–16):
  - Antes: `` cualificador `provisional`). `postponed` y `suspended` solo por fuente con`` / `` prioridad de federación o por operador. No hay más transiciones automáticas.``
  - Después:
    ```
      cualificador `provisional`). `postponed` y `suspended` los da la fuente
      ganadora, como cualquier otra transición. Sin federación ni operador que lo
      confirme, salen `provisional`. Salir de ellos es una transición más y sigue
      la misma regla. No hay más transiciones automáticas.
      *Enmendada el 2026-10-04 por ADR-012.*
    ```
  - Con ese texto `src/arch/reglas-rn02.test.ts` pasa 5/5 (comprobado sobre una copia en el scratchpad) y `npm run gates` queda en 0.
- **F-SPEC-016-2** (CA-2 (iv), para el verificador). `settle` exigía `sameScore`, que es falso sin marcador: un `postponed` nunca se confirmaba con una segunda fuente. Se cambia por `agrees` (mismo estado y, si lleva marcador, el mismo). Efecto colateral: dos fuentes que dicen `scheduled` también salen `confirmado` (antes `provisional`). Ningún test existente lo fijaba; hoy solo hay una fuente.
- **F-SPEC-016-3** (CA-5, ruido de entorno). `src/ingest/reconciliacion.db.test.ts` (SPEC-013 CA-6) agotó 2 veces el timeout de 5 s en `npm run test:db` y pasó en las 2 siguientes. Tarda 3,2–3,3 s tanto en esta rama como en `0a40046` (worktree temporal). No depende de esta spec; candidato a subir su timeout (EPIC-MEJORA).
- **F-SPEC-016-4** (nota). El `main` local está atrasado (`e883465`); la base real es `origin/main` = `0a40046`, la que se congela en `engine-0a40046.ts`.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- CA-2, CA-3, CA-4 y CA-5 implementados con test en verde. CA-1 tiene el test en rojo y espera a que sdd-arquitecto aplique F-SPEC-016-1 en `reglas.md`. Con eso, `npm run gates` → 0 sin tocar código.
- Evidencia de la exportación del fixture: `host aws-1-eu-west-1.pooler.supabase.com`, `transaction_read_only: on`, 319 filas, 0 Decisions, `received_at = observed_at` en todas, sin claves (grep contra los valores de `.env`: ausentes).
- No fusionar antes de que el titular lea CA-5 de SPEC-013 (lunes 5, tras las 21:00Z).
- Si SPEC-014 entra antes, rebasar `engine.ts` y `engine.test.ts` (N-2).
