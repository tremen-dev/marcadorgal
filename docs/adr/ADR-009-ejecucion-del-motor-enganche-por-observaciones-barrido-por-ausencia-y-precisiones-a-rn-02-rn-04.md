---
id: ADR-009
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-21, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-009: Ejecución del motor: enganche por observaciones, barrido por ausencia y precisiones a RN-02/RN-04

- Deciders: sdd-arquitecto propone (2026-09-21); Alberto Fojo ya cerró el fondo en el gate de SPEC-007 (H-1..H-6, 2026-09-21) y la implementación lo ejercitó (GREEN, ledger de SPEC-007); aprobación formal de este ADR pendiente.
- Specs relacionadas: SPEC-007 (origen, R-SPEC-007-1); SPEC-006 y ADR-008 §6 (enganche); la spec d de EPIC-002 (despliegue y medición) y EPIC-004 (operador y fuentes push) lo consumen.

## Contexto

ADR-004 fija el motor como función pura que corre «en el mismo request que
inserta observaciones» y escribe en su transacción. Es cierto pero incompleto:
describe lo que nace de un dato y calla sobre lo que nace de su **ausencia**.
RN-05 (silencio) y el cierre forzoso de RN-02 se disparan precisamente cuando
ninguna fuente habla, y el `afterInsert` de ADR-008 §6 solo corre si algún
intento insertó observaciones. Además, implementar SPEC-007 obligó a precisar
el orden de evaluación (F-SPEC-007-1), la adyacencia de RN-04 (F-SPEC-007-2),
el rastro del cierre forzoso (H-5 (iii), F-SPEC-007-3, F-SPEC-007-4) y el
alcance de la valla de pureza (F-SPEC-007-5, O-2). ADR-004 está aprobado y es
inmutable; estas precisiones no lo contradicen, pero constriñen trabajo futuro
—EPIC-004 mete al operador por el mismo camino—, así que viven aquí.

## Decisión

1. **Doble enganche.** El motor se ejecuta dos veces por tick. (a)
   `afterInsert(tx, observations)`, dentro de la transacción que inserta las
   Observations, sobre los partidos observados: lo que nace de un dato se
   escribe con el dato, como exige ADR-004 y el criterio 4 de EPIC-002. (b)
   **Barrido** (`createEngineSweep`) al final del tick, en **su propia
   transacción**, sobre **todos** los partidos en ventana, y solo si hay
   alguno. Sin barrido, RN-05 y el cierre forzoso jamás disparan: `afterInsert`
   no corre si nadie insertó nada, que es exactamente lo que pasa cuando la
   fuente calla. Lo ya decidido en (a) sale `null` en (b) por idempotencia, así
   que no se cuenta ni se escribe dos veces. Un fallo del barrido no tumba el
   tick: queda en `TickSummary.engineError`. Amplía ADR-008 §6.
2. **Idempotencia por tupla publicada.** Nace una Decision nueva con cada
   cambio de `(status, score, minute, addedMinute, qualifier)`, **minuto
   incluido**; un cambio solo de `rule` no escribe fila. Coste aceptado: ~1
   Decision cada 30 s por partido `live`, ~160 por partido, ~8.000 por jornada
   de las cinco ligas, a cambio de que el minuto avance en pantalla.
3. **Orden de evaluación, con dos guardas que no publican.**
   `operator` → cierre forzoso RN-02 → RN-05 silencio → **guarda de legalidad
   de transición (RN-02)** → RN-03 → RN-04 → RN-01. Las dos guardas —legalidad
   de transición y RN-04— nunca publican y por eso nunca aparecen en
   `Decision.rule`; la precedencia de RN-06 gobierna solo qué regla se registra
   cuando sí se publica. La guarda de legalidad se aplica **solo a la
   observación ganadora**: si su transición es ilegal se descarta, no se
   promueve en su lugar ninguna fuente de menor prioridad y no se abre alerta.
   RN-05 y RN-03/RN-04/RN-01 son **excluyentes por construcción** —RN-05 solo
   se evalúa sin observación ganadora y las otras tres solo con ella—, así que
   su orden relativo es indiferente y la lectura de RN-06 queda intacta.
4. **Cierre forzoso con rastro.** A `kickoff + 120 min` un partido `live` se
   publica `finished` con el marcador vigente, `provisional`, `rule: 'RN-02'`,
   **aunque sigan llegando observaciones `live`**, y **siempre** abre una Alert
   `forced_finish` con el rastro (`score`, `minute`, `kickoff`,
   `lastObservedAt`, `lastStatus`). Publicar un resultado falso sin rastro es
   peor que publicarlo con rastro. El rastro sale de `lastHeard`, la última
   observación conocida **de cualquier antigüedad** (cuarta consulta
   `distinct on (match_id)` sin cota de tiempo), porque un partido en silencio
   por definición no tiene nada dentro de la ventana: el caso para el que se
   inventó el campo era justo el que lo dejaba `null`. `lastHeard` no cambia
   qué Decision se produce, solo los `details`; por eso el replay no lo pasa y
   sigue siendo autocontenido. La alerta **no se auto-resuelve nunca**: el
   motor solo cierra `silence` al volver la señal; `forced_finish`,
   `regression` y `conflict` las cierra el operador (EPIC-004).
5. **Adyacencia de RN-04.** Dos fuentes son adyacentes si ninguna otra con
   observación **en la línea de tiempo del partido** tiene prioridad
   estrictamente entre las suyas; igual prioridad cuenta. El conjunto conocido
   son las fuentes presentes en `observations`, porque la prioridad entra al
   motor como función y no se puede enumerar. Con una sola fuente registrada
   hoy no se dispara nunca.
6. **Frontera de pureza de `src/decide/`.** El motor no sabe que existe una
   base de datos: recibe datos y devuelve borradores (sin `id` ni `version`:
   los pone la base, ADR-006 §3), las prioridades entran como función y el
   reloj como parámetro. Todo el SQL y toda la deduplicación de alertas por
   `(kind, match_id)` viven en `src/ingest/engine.ts`. La valla
   (`src/arch/decide-purity.test.ts` más un grep de `new Date(`, `Date.now(`,
   `Math.random(`, `crypto.` y `fetch(`) alcanza **también a los `*.test.ts`**
   de `src/decide/`: los casos construyen sus instantes con `shiftInstant` y no
   dependen del reloj de la máquina. El test de árbol de imports sí excluye los
   tests, porque el replay necesita leer un fixture real.

## Consecuencias

### Positivas
Un partido que el proveedor abandona se cierra igual, y con rastro auditable.
El operador de EPIC-004 entra por el mismo `IngestTx` y por las mismas dos
llamadas, sin caso especial. El motor sigue siendo replayable y testable sin
infraestructura.

### Negativas / follow-ups
El barrido añade una transacción y cuatro consultas por tick sobre ≤ 50
partidos. `decisions` crece ~8.000 filas por jornada (ADR-006 §5 ya razona que
no hace falta índice nuevo; se vigila en la primera jornada). Si el tick que
cruza `kickoff + 120 min` trae además el `finished` real del proveedor, se
publica igualmente el `RN-02` y queda una `forced_finish` que a posteriori
sobraba: se acepta como la dirección segura, la deduplicación impide que se
repita y el operador la cierra. Una fuente nueva de prioridad intermedia
cambia quién es adyacente a quién sin tocar código: es un dato del registro.
Nada de esto se ha ejercitado contra el proveedor real (primera ventana:
viernes 2026-09-25); lo mide la spec d.

## Alternativas consideradas

- **Solo `afterInsert`** (la letra de ADR-004): RN-05 y el cierre forzoso no
  disparan nunca cuando la fuente calla, que es justo cuando hacen falta.
- **Solo barrido**, sin enganche: rompe el criterio 4 de EPIC-002 (la Decision
  deja de escribirse en la transacción de sus Observations) y añade hasta 30 s
  de latencia a cada gol.
- **Cierre forzoso silencioso** (propuesta original de H-5 (iii)): publica un
  `finished` sin confirmación de ninguna fuente y sin dejar nada que mirar.
  Rechazado por el titular.
- **Motor en un job aparte** (pg_cron llamando a un endpoint de decisión):
  segundo disparador que mantener y decisiones desacopladas de su dato.
- **Decision nueva solo por cambio de marcador o estado**: menos filas, pero el
  minuto se congela en pantalla.
- **`lastObservedAt` desde la ventana de 15 min**: sale `null` exactamente en
  el caso de silencio, que es su razón de ser.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
