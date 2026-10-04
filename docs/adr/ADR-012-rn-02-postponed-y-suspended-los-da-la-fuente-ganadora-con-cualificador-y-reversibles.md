---
id: ADR-012
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-04, por: sdd-arquitecto}
---
# ADR-012: RN-02: `postponed` y `suspended` los da la fuente ganadora, con cualificador y reversibles

- Deciders: sdd-arquitecto propone (2026-10-04) a partir del hallazgo de campo del 2026-10-03 que encargó **Alberto Fojo (titular)**. La intención de fondo es suya y ya está escrita en ADR-011: el producto es automático, sin «un operador el 100 % del tiempo vigilando». **Alberto Fojo decide H-1..H-3 en el gate del 2026-10-04**, con las recomendaciones del arquitecto.
- Specs relacionadas: **SPEC-016** lo implementa. Enmienda **solo la frase de `postponed`/`suspended` de RN-02**; el resto de RN-02, ADR-009 §3 y §4, ADR-010 y ADR-011 siguen vigentes. Evidencia: `docs/epicas/EPIC-002-ingesta-y-motor/_qa/RN-02-postponed/medicion.md`.

## Contexto

RN-02 dice: «`postponed` y `suspended` solo por fuente con prioridad de
federación o por operador». Hoy no hay ninguna de las dos: API-Football pesa 10,
la federación empieza en 50 y el operador es EPIC-004. `sabadell-andorra`
(2026-10-03) recibió **319 observaciones `PST`**, la ventana entera, y **0
Decisions**: `board` lo da `scheduled` con kickoff pasado y así se queda. El
motor cumple la regla; lo que falla es la regla (SPEC-009 N-9, c2-ii). Medido
en `dev`: 1 de 71 partidos, 0 vueltas a jugarse. La guarda lo descarta sin
alerta (ADR-009 §3), así que nadie se entera.

## Decisión

1. **Letra nueva de la frase** (el resto de RN-02 no cambia):
   > `postponed` y `suspended` los da la fuente ganadora, como cualquier otra
   > transición. Sin federación ni operador que lo confirme, salen
   > `provisional`. Salir de ellos es una transición más y sigue la misma regla.
2. **En código, una línea.** `transitionAllowed` (`src/decide/engine.ts`) deja
   de exigir `priority >= FEDERATION_PRIORITY` para ir a `postponed` o
   `suspended`. Se publica por `rule: RN-01` con `settle`: `provisional` con
   una sola fuente no oficial, `confirmado` con federación o con una segunda
   fuente que coincide (SPEC-007 CA-7). Ni migración ni campo nuevo.
3. **Reversible sin caso especial.** La guarda ya deja salir de `postponed` y de
   `suspended` a `scheduled`, `live` o `finished`. Solo `finished` es
   terminal. Un `PST` erróneo se deshace en el primer tick en que la fuente dé
   otro estado, siempre que la ventana siga abierta (`isInWindow` no saca de
   ventana a `postponed` ni a `suspended`). Si el partido se reprograma,
   `calendario:load` actualiza el kickoff y la ventana se abre de nuevo.
4. **El cierre forzoso no los toca.** RN-02 a +120 solo cierra un `live`
   (ADR-009 §4). Un `suspended` no se convierte en un `finished` inventado.
5. **Sin alerta propia** (H-2). Se ve en el log y en el cualificador.

## Consecuencias

### Positivas
`sabadell-andorra` se habría publicado `postponed provisional` desde las
16:20:25Z, como dice el proveedor. El informe de jornada lo cuenta como
aplazamiento acordado (SPEC-009 N-8), no como discrepancia. Cuando llegue una
fuente de federación (EPIC-004), confirma sin reescribir nada.

### Negativas / follow-ups
- **Un `PST` erróneo se publica** hasta que la fuente se corrige: «Aprazado
  (provisional)» sobre un partido que se juega. Sin datos medidos (n = 1). El
  coste es la duración del error del proveedor, igual que un gol fantasma en
  ADR-011. Si se corrige después de kickoff +150, nadie lo oye. Es el mismo
  límite de M-7 y de RN-12.
- **`INT` → `suspended`** (`results.ts`): una interrupción breve (tormenta,
  luz) se publicará «Suspendido» y volverá a `live`. Es honesto, pero
  parpadea. No se toca el mapeo aquí.
- Un `postponed` a mitad de partido borra el marcador publicado (`postponed`
  no lleva marcador en `MatchState`). Sin casos. Se acepta.
- Con una fuente de federación **no fresca** (> 5 min, RN-01), API-Football
  puede deshacer su `postponed`. El «dueño» de ADR-011 no se extiende al
  estado: se decide en EPIC-004 si hace falta.
- `engine.test.ts` «does not publish postponed from a provider» se invierte.

## Alternativas consideradas
- **Mantener la letra hasta EPIC-004.** Rechazada: es el «operador el 100 %»
  que el titular descartó en ADR-011, y hasta entonces el partido miente.
- **Umbral de persistencia** (N observaciones o X min de `PST`). No protege de
  un proveedor que se equivoca de forma persistente y solo retrasa el caso
  bueno. Aquí el `PST` ya estaba al abrir la ventana. Mismo argumento que
  ADR-010 contra los umbrales.
- **Solo `postponed` desde `scheduled` y solo `suspended` desde `live`.** Más
  guarda sin ningún caso que la pida. Si aparece uno, se mide primero.
- **Publicarlo con una alerta nueva.** Nadie la resuelve hasta
  EPIC-004 y el cualificador ya dice que es de una sola fuente.

## Decidido por el titular (Alberto Fojo, 2026-10-04)
- **H-1 Sí.** Un `postponed` o `suspended` de una fuente automática se
  publica sin operador, sale `provisional` y se puede deshacer.
- **H-2 No.** No abre alerta informativa, igual que en ADR-011 H-2.
- **H-3 Sí.** `sabadell-andorra` se queda en `dev` como está, con 0 Decisions,
  hasta que se reprograme. `replay:jornada --aplicar` no se extiende, porque
  solo corrige partidos `finished`. Ver R-SPEC-016-1.
