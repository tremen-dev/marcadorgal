---
id: ADR-019
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-15, por: sdd-arquitecto}
---
# ADR-019: Motor serializado por partido: cerrojo de fila antes de leer la vigente

- Deciders: sdd-arquitecto propone (2026-10-15) con la medición de
  `docs/epicas/EPIC-MANT-mantenimiento/_qa/investigacion-2026-10-15/INFORME.md`
  §1. Alberto Fojo eligió el mecanismo y la semántica de `decided_at` en el gate
  de SPEC-035 (H-1, H-2, 2026-10-15). La aprobación formal está pendiente.
- Specs relacionadas: SPEC-035, que lo origina. EPIC-004 (operador, webhook y
  fuente RFEF) y el encendido de `board_delta` (SPEC-024 N-1) lo consumen.
  **Precisa ADR-009 §1**, sin superseder nada.

## Contexto

ADR-009 §1 da por hecho que lo que el `afterInsert` ya decidió «sale `null` en
el barrido por idempotencia». Eso solo es cierto si las dos ejecuciones no se
solapan. El cerrojo de ADR-008 §3 cubre `openAttempt` y nada más. Con pg_cron y
Vercel Cron a 1-4 s, dos transacciones leían la misma vigente y el trigger
`assign_decision_version` (max+1) escribía dos versiones. Hubo 36 versiones
gemelas entre el 22-09 y el 12-10. El daño latente es una versión mayor con el
marcador viejo, un 23505 que deshace las Observations del intento, y emisiones
dobles o desordenadas con Realtime.

## Decisión

1. **Cerrojo de fila por partido, antes de leer.** Toda ejecución del motor
   empieza en su transacción con `select … from matches where id = any(…)
   order by id for no key update`. La lectura de la vigente, de las
   Observations y de `lastHeard`, y la escritura de Decisions y alertas, van
   después y en la misma transacción. Con READ COMMITTED, quien espera ve lo
   que confirmó el otro, y la idempotencia de ADR-009 §2 vuelve a valer. El
   `order by id` fija el orden de los cerrojos y evita interbloqueos.
2. **Un solo camino para escribir Decisions.** Ningún escritor, de hoy o
   futuro, inserta en `decisions` fuera de `decideMatches`
   (`src/ingest/engine.ts`). Eso incluye el `afterInsert`, el barrido, las
   herramientas de reconciliación, el operador, el webhook y cualquier fuente
   nueva como RFEF. Así hereda el cerrojo de §1, y lo amplía ADR-009 §6 (todo
   el SQL del motor vive en `src/ingest/`). `src/decide/` sigue puro y no sabe
   nada del cerrojo.
3. **`decided_at` sigue siendo el `now` del tick** (ADR-008 §7). No promete
   orden. Un tick con `now` anterior que confirma después puede escribir una
   versión distinta con `decided_at` menor. El orden de publicación lo dan
   `version` y `recorded_at` (ADR-016), y nadie ordena por `decided_at`.
4. **Vigilancia.** `informe:jornada` cuenta las versiones gemelas (la tupla de
   ADR-009 §2 igual a la de la versión anterior) y los `decided_at` invertidos.
   Con §1 en pie, las gemelas son siempre 0.

## Consecuencias

### Positivas
Una Decision por cambio, ningún 23505 posible entre ticks y un orden de
versiones que respeta lo leído. Realtime puede encenderse sin emisiones
dobles. El operador y RFEF entran sin pensar en concurrencia.

### Negativas / follow-ups
Un tick puede esperar al otro mientras dure la transacción del motor, que es
corta (≤ 50 partidos). No hay `lock_timeout`: en el `afterInsert`, un fallo por
espera desharía las Observations. Los `decided_at` invertidos con contenido
distinto siguen siendo posibles y se cuentan (§4). Las 36 gemelas que ya
existen se quedan, porque las Decisions son append-only (RN-07).

## Alternativas consideradas

- **`for update`**: choca con el `key share` que toman las FK de
  `observations` y `decisions`. El `afterInsert`, que ya insertó
  Observations, interbloquearía con el barrido.
- **`pg_advisory_xact_lock` por partido**: `web_reader` puede tomar advisory
  locks (residuo de ADR-015 §1) y congelaría el motor. El cerrojo de fila exige
  privilegios sobre `matches`, y `web_reader` no los tiene.
- **No barrer cuando la cadencia salta el intento**: RN-05 y el cierre forzoso
  quedarían a merced del otro disparador. Tampoco cubre dos `afterInsert` de
  fuentes distintas.
- **Cerrojo en el trigger de versión** o `serializable`: el primero no evita
  leer la vigente rancia; el segundo cambia reintentos a todo el tick.
- **`decided_at = max(now, vigente)`**: toca `src/decide` y falsea el reloj
  del dato (D-9).

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
