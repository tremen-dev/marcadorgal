---
id: ADR-033
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
  - {estado: aprobada, fecha: 2026-11-10, por: titular, nota: "renumerado de ADR-031 a ADR-033 al fusionar con main, que ya tenía ADR-031 y ADR-032; sin cambio de decisión"}
aprobada-por: Alberto Fojo
---
# ADR-033: Back-fill histórico: Explorer manda en las jornadas pasadas y el operador corrige el cierre

- Deciders: **Alberto Fojo (titular)** decide el 2026-11-09 que, en las jornadas ya disputadas, Explorer es la verdad («hay marcadores que se guardaron mal porque el código en aquel entonces no estaba bien del todo […] sobreescribirlos con los datos de este script, si puede ser con goleadores mejor»). sdd-arquitecto lo redacta a raíz del RED de SPEC-060 (V-2, V-3). Lo aprueba el titular en el gate.
- Specs relacionadas: SPEC-060 (lo ejecuta). **Precisa, sin superseder:** ADR-025 §6, que sigue rigiendo `rfef:recuperar`; este ADR abre un segundo camino manual, distinto y acotado. Se apoya en RN-01 («el operador tiene siempre la prioridad máxima»), RN-06 (orden: operador primero), D-6 y ADR-006 §3 (append-only, versión por trigger) y ADR-007 (raw store).

## Contexto
Entre el 14-08 y el 08-11 de 2026 hay partidos con la Decision vigente mal: finales que el motor de entonces no cerró, cierres forzosos con el marcador de la última observación o marcadores de fuentes ya retiradas. ADR-025 §6 dice que, para un partido cerrado, la recuperación manual guarda la observación y abre una alerta `conflict` si el marcador no coincide, pero nunca escribe una Decision. Seguir esa regla deja la web mal y cientos de alertas que nadie va a resolver una por una. Borrar no es posible: `observations` y `decisions` son append-only por trigger (D-6). La implementación de SPEC-060 lo resolvió con un INSERT a mano de una Decision `RN-01`, que el motor no había aplicado, y con una observación sin crudo y con `observed_at` = kickoff (V-2, V-3).

## Decisión
1. **Ámbito.** Solo `historico:sync` (SPEC-060), lanzado a mano por el titular tras revisar el dry-run, y solo para partidos con kickoff en una fecha Europe/Madrid **anterior a hoy**. El tick, el barrido y `rfef:recuperar` no cambian.
2. **La corrección es del operador, no de una fuente.** Si Explorer da el partido `FINISHED` y la Decision vigente no es `finished` con ese marcador (o no existe), se inserta una observación con `source_id = 'operator'`, `status = finished`, marcador de Explorer, `observed_at` = instante de la lectura (reloj de la herramienta, D-9) y `raw_ref` al crudo de esa lectura. Después, el motor decide con `now` = ese `observed_at`, por el mismo camino que la recuperación (`decideRecovered`, ADR-025 §4). El operador gana con prioridad 100 y publica `operator · confirmado`. **Nadie escribe una Decision a mano**: la versión la pone el trigger (ADR-006 §3) y el replay la reproduce.
3. **Igualdad = silencio.** Si la vigente ya es `finished` con el marcador de Explorer, no se escribe nada (ni observación ni Decision). Si Explorer no da `FINISHED`, tampoco: se informa del partido y no se toca.
4. **Rastro.** Cada fecha consultada abre un `ingest_attempt` con `source_id = 'operator'`. El crudo de Explorer se guarda en el raw store **antes** de parsearlo (ADR-007, RN-09), y el intento se cierra con `ok`, `error` y el número de observaciones.
5. **Goleadores.** `match_goals` no es un log (no es D-6). Se reemplaza por partido solo cuando Explorer da `FINISHED` y los goles válidos de cada equipo suman su marcador. Si no se cumple, se dejan los goles que haya.

## Consecuencias
### Positivas
El histórico queda como lo da Explorer, con observación, crudo, intento y Decision trazables (RN-06). El motor puro no cambia y `replay:jornada` reproduce la corrección. La corrección no deja alertas `conflict` pendientes.
### Negativas / follow-ups
- Entran en `observations` filas del operador antes de EPIC-004: `informe:jornada`, `informe:latencia` y `salud` deben ignorar las `source_id = 'operator'` (o contarlas aparte) como fuente no registrada.
- Las Decisions corregidas llevan `decided_at` de hoy: es una corrección, no un directo. SPEC-039 ya mide aparte.
- Si Explorer se equivoca, el error se publica `confirmado`. El dry-run revisado por el titular es el control.

## Alternativas consideradas
- **ADR-025 §6 tal cual (observación + `conflict`)**: deja la web mal y abre cientos de alertas sin nadie que las resuelva.
- **Decision `RN-01` o `operator` por INSERT a mano** (lo que hizo SPEC-060): `RN-01` sin motor miente en RN-06, y el replay diverge.
- **Observación `rfef` a la hora de la lectura y motor**: RN-01 no la deja ganar sobre un `finished` cerrado. Además, la prioridad 5 no expresa que la verdad la impone una persona.
- **Borrar y recargar**: lo prohíbe D-6.
- **Superseder ADR-025**: §1-§5 siguen vigentes y §6 sigue valiendo para `rfef:recuperar`. Basta con una precisión.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
