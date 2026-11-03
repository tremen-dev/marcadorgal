---
id: ADR-027
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-03, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-027: Una fuente puede observar el directo de una competición sin decidirlo (`liveObservedOnly` del registro)

- Deciders: sdd-arquitecto propone (2026-11-03) a encargo del orquestador. **Alberto Fojo (titular)** fijó el marco el 2026-11-03: mitigación urgente antes del 2026-11-07, la rfef no publica marcador en directo en Primera y Segunda División hasta confirmar la causa del 0-0 congelado; API-Football sigue en gratuito. Aprobado por el titular el 2026-11-03.
- Specs relacionadas: SPEC-048 (lo ejecuta); SPEC-039 (sigue midiendo con esas observaciones); SPEC-044 / ADR-025 (el final del acta sigue entrando). **Relación con ADR-026 (borrador, SPEC-046):** este ADR resuelve de forma temporal su H-1 y su §1 con otro mecanismo (registro en vez de constante del adaptador, y la observación se guarda). Si ADR-026 se aprueba, su §1 debe citar este campo en vez de `RFEF_LIVE_COMPETITIONS`. Amplía ADR-003 (contrato del registro) sin superseder; no toca RN-01..RN-12 ni `src/decide/`.

## Contexto
2026-11-02, `primera-division-2026-27-j11-deportivo-osasuna` publicado `finished` 0-0 (real 2-1): 215 observaciones rfef `live` 0-0 sin un cambio, cerradas por el cierre forzoso de RN-02. La investigación en explorer apunta (certeza media) a que el panel de la RFEF no lleva el directo de Primera y Segunda; las tres RFEF sí. El acta (`FINISHED`) sí fue buena en lo medido (SPEC-044: Oviedo 2-3, Valladolid 4-3). Con API-Football fallando siempre, la rfef es la única fuente el fin de semana del 2026-11-07/08.

## Decisión
1. **Campo nuevo del registro.** `SourceConfig.liveObservedOnly?: CompetitionId[]` (por defecto vacío; subconjunto de `competitions`, validado al importar). En esas competiciones las observaciones `live` de esa fuente **se guardan como siempre** (crudo, fila en `observations`, intentos) pero **no se entregan al motor**: no ganan RN-01, no confirman, no cuentan como «oído» para RN-05 ni para `lastHeard`. `scheduled`, `finished`, `postponed` y `suspended` entran como hoy.
2. **Dónde se filtra.** En la frontera ingesta→motor, con una función pura de `src/ingest/` aplicada en **todas** las entradas al motor: `decideMatches`, el motor a la hora de la observación (ADR-025 §4) y la repetición de jornada (`replay-jornada`), para que el replay no proponga correcciones que el motor real nunca haría. `src/decide/` no cambia.
3. **Valor inicial.** rfef: `liveObservedOnly: ["primera-division", "segunda-division"]`. Revertir es borrar esas entradas en `src/sources/registry.ts` y desplegar; no hay migración ni dato que deshacer, porque las observaciones ya están guardadas.
4. **Lo que se ve.** Sin otra fuente, el partido sigue `scheduled` y a kickoff + 15 pasa a `scheduled · sen_sinal` (RN-05 en `scheduled`, ADR-013 §2); al llegar el `FINISHED` de la rfef (export del día o `rfef:recuperar`, ADR-025) pasa a `finished · provisional` por RN-01 (`scheduled → finished`, ADR-013). Sin `live`, no hay cierre forzoso que publique un marcador congelado.

## Consecuencias
### Positivas
Nada que la rfef dé en directo en Primera/Segunda llega al público; los finales del acta sí. Reversible con una línea. SPEC-039 conserva las observaciones `live` para medir desfase y dígitos falsos.
### Negativas / follow-ups
- Primera y Segunda sin directo público mientras dure (con API-Football en gratuito no hay otra fuente). Es la verdad, no una regresión.
- Si la RFEF publicara un `FINISHED` con el marcador congelado (no observado hasta hoy), se publicaría como `finished · provisional`; RN-12 no lo corrige porque no es cierre forzoso. SPEC-048 CA-5 lo vigila con datos; el remedio de fondo es ADR-026 §3 y la herramienta de operador de SPEC-046.
- Un campo más en el contrato del registro (ADR-003) que puede quedarse vacío para siempre.

## Alternativas consideradas
- **Quitar Primera/Segunda de `competitions` de la rfef**: una línea, pero el tick deja de pedirlas y se pierden el final del acta (los partidos se quedarían `scheduled · sen_sinal` sin final) y las observaciones que mide SPEC-039.
- **Saltar `LIVE_PROVISIONAL` en el adaptador (ADR-026 §1)**: barato, pero la observación no llega a `observations` (solo el crudo) y SPEC-039 pierde su medida; y la lista vive en código del adaptador, no en el registro.
- **Prioridad por estado dentro del motor**: cambia la firma de `decide` y los fixtures de replay; más caro y toca la parte pura sin necesidad.
- **Bajar la prioridad de la rfef a 1 en esas competiciones**: con API-Football muda, sigue ganando sola.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
