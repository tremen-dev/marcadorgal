---
id: SPEC-016
tipo: spec
epica: EPIC-002
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-04, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-04, por: Alberto Fojo}
---
# SPEC-016 — RN-02 por fuente: aplazado y suspendido sin operador

## Problema
RN-02 solo deja publicar `postponed` y `suspended` a una fuente de federación o
al operador, y hoy no existe ninguno de los dos. El 2026-10-03,
`sabadell-andorra` recibió 319 observaciones `PST` de API-Football, que cubren
la ventana entera, y ninguna Decision. `board` lo sigue dando `scheduled` con
el kickoff ya pasado (`_qa/RN-02-postponed/medicion.md`). **ADR-012** cambia
la frase de RN-02: `postponed` y `suspended` los da la fuente ganadora, salen
`provisional` y se pueden deshacer. Esta spec lo implementa.

## Usuarios / roles afectados
- Titular: aprobó ADR-012 y decidió H-1..H-3 en el gate del 2026-10-04: H-1 sí, H-2 no y H-3 sí (ver N-5).
- sdd-arquitecto: escribe la letra de CA-1 (hook protege-verdad; precedente F-SPEC-013-1).
- Público (EPIC-003): ve «Aprazado» o «Suspendido» con cualificador `provisional`.

## Criterios de aceptación
- **CA-1 La verdad dice lo que fija ADR-012.** En `reglas.md`, la frase de `postponed`/`suspended` de RN-02 pasa a ser idéntica al bloque citado de ADR-012 §1. El resto de RN-02 no cambia. Debajo va la nota `*Enmendada el <fecha> por ADR-012.*`. `FOUNDATION.md` no cambia. Verificable: un test nuevo, `src/arch/reglas-rn02.test.ts`, que sigue el patrón de `reglas-rn03` y `reglas-rn12`. El test lee la cita de ADR-012 y comprueba que `reglas.md` la contiene junto con la nota. Debe estar en verde.
- **CA-2 El motor publica y deshace sin operador.** Tests en `src/decide/engine.test.ts` con una fuente de prioridad 10:
  - (i) Sin Decision, una observación `postponed` publica `postponed`, `rule: RN-01`, `provisional`, sin alertas. El test «does not publish postponed from a provider» se invierte.
  - (ii) Vigente `live 1-1` y observación `suspended 1-1` → publica `suspended 1-1` `provisional`.
  - (iii) Vigente `postponed` → una observación `live` publica `live`, y una `scheduled` publica `scheduled`. Vigente `suspended` → una `live` publica `live`.
  - (iv) Si una segunda fuente de prioridad 20 dice lo mismo, sale `confirmado`. Una fuente de federación sigue dando `confirmado`: los tests de hoy con `"fifty"` siguen en verde.
  - (v) Vigente `suspended` a kickoff + 120 → ni cierre forzoso ni alerta `forced_finish`.
  - (vi) Vigente `finished` y observación `postponed` → no se publica nada (la guarda de `finished` sigue intacta).
- **CA-3 El caso real lo demuestra.** Hay un fixture, `src/decide/fixtures/sabadell-andorra-2026-10-03.ts`, con las 319 observaciones del partido exportadas de `dev` en solo lectura (son filas de `observations`, no crudo). En `src/decide/replay.test.ts`, contra ese fixture y nunca contra la red ni la base:
  - Con el motor de `main` sale **0** Decisions.
  - Con el de esta spec sale **1**: `postponed`, `provisional`, `RN-01`, `decidedAt` = `2026-10-03T16:20:25.643Z`. No sale ninguna más (idempotencia, ADR-009 §2).
- **CA-4 La ventana no cambia.** En `src/ingest/window.test.ts`, un partido `postponed` y uno `suspended` siguen en ventana hasta kickoff + 150 y salen de ella después. Así se fija lo que §3 de ADR-012 da por hecho. `window.ts` no cambia.
- **CA-5 Gates y nada de más.** `npm run gates` → 0 y `npm run test:db` en verde. No hay migración. `package.json` no cambia. `git diff main --stat -- src/sources supabase` sale vacío: el mapeo `PST`/`CANC`/`SUSP`/`INT`/`ABD` no se toca.

## Entidades y reglas afectadas
Decision, Observation, Estado de partido, Cualificador (dominio.md). **RN-02**
(la enmienda), RN-01 (publica), RN-06 (se registra `RN-01`), RN-07. **ADR-012**
es lo que se ejecuta. ADR-009 §3–§4, ADR-010 y ADR-011 siguen vigentes.

## Fuera de alcance
- Arreglar `sabadell-andorra` en `dev` (H-3 de ADR-012). Queda en R-SPEC-016-1.
- Separar `INT` de `suspended` en `results.ts`.
- Darle dueño al estado, como ADR-011 hace con el marcador. Decide EPIC-004.
- Las alertas informativas (H-2) y el operador.
- Si EPIC-002 espera a esta spec para cerrar: lo decide sdd-producto.

## Notas para el gate humano
- **N-1 No se aprueba antes que ADR-012.**
- **N-2 Spec propia, no un CA de SPEC-014.** Comparten motor y ventana, pero no
  regla ni ADR. SPEC-014 está aprobada, lleva 10 CA y una migración, y meter
  esto ahí obligaría a reabrir su gate. Esta spec es una línea de
  `transitionAllowed` más tests, sin migración, y se puede fusionar sola. El
  daño está activo: el próximo `PST` se perderá igual. Por eso se recomienda
  implementarla **antes** que SPEC-014. Cualquiera de las dos que vaya detrás
  solo tendrá que rebasar `engine.ts` y `engine.test.ts`.
- **N-3 Riesgo de un `PST` erróneo**, para mirarlo con lupa. Se publica
  «Aprazado (provisional)» hasta que la fuente dé otro estado. Vuelve solo
  mientras la ventana siga abierta (+150). Medido: 0 casos de 1.
- **N-4 Informe de la jornada del 2026-10-02/04.** Si se genera antes de esta
  spec, `sabadell-andorra` sale como discrepancia (`scheduled` frente a
  `postponed`). Es un defecto de regla (c2-ii) y lo explica ADR-012. No es
  un fallo de ingesta.
- **N-5 (decidido por Alberto Fojo, 2026-10-04).** En el gate aprueba ADR-012
  y esta spec con las tres recomendaciones del arquitecto:
  - **H-1 Sí.** `postponed` y `suspended` de una fuente automática se publican `provisional` y se pueden deshacer (CA-2).
  - **H-2 No.** No hay alerta informativa: ningún CA la pide.
  - **H-3 Sí.** `sabadell-andorra` se queda en `dev` como está hasta que se reprograme (R-SPEC-016-1).
