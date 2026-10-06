---
id: ADR-010
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-29, por: Alberto Fojo}
---
# ADR-010: El cierre manda sobre la monotonía, y reconciliación tras el cierre forzoso

- Deciders: sdd-arquitecto propone (2026-09-29); Alberto Fojo **aprueba el 2026-09-29**. Llega aquí por decisión humana del 2026-09-29 (SPEC-009 **N-9**, opción B para V-12), que deriva **R-SPEC-009-2** al arquitecto en vez de arreglarlo dentro de SPEC-009.
- Specs relacionadas: **SPEC-009** (origen, jornada medida 2026-09-25/28); **SPEC-012** consume §1 y §4; **SPEC-013** consume §2 y §3. Precisa RN-02 y RN-03 sin contradecir ADR-004 ni ADR-009; EPIC-004 (operador, segunda fuente) sigue detrás.

## Contexto

RN-03 dice que un marcador no baja **salvo por el operador**, y el operador es
EPIC-004: hoy no existe. Con **una sola fuente**, en vivo, una corrección real y
un error de la fuente son indistinguibles, que es justamente el problema que
RN-03 se escribió para no tener que resolver. La jornada de SPEC-009 midió el
precio: **7 de 39 marcadores finales equivocados**.

- **8 alertas `regression`**: la fuente publica un gol fantasma y se retracta, y
  RN-03 retiene el falso **hasta el final**. **6 acabaron mal, 2 acabaron bien.**
- **El umbral de confirmaciones no separa los dos grupos**: los dos aciertos
  tienen **46** y **87** confirmaciones seguidas del marcador bajo, y el peor
  fallo tiene **3** (`lugo-racing-ferrol`). Cualquier listón parte el grupo por la
  mitad. Tabla completa en `_qa/SPEC-009/hallazgos-jornada.md`, hallazgo 2.
- **9 cierres forzosos de 39**, todos con `minute: 90` y `lastStatus: live`: la
  fuente deja el partido clavado en el 90 y **no manda el final** dentro de
  kickoff + 120. RN-02 cierra, que es su trabajo, y el marcador se congela ahí.
- **El motor cumple las reglas al pie de la letra.** Lo equivocado es la regla.

ADR-004 es inmutable y no se contradice: fijó el motor y su precedencia, pero
calló sobre **el instante del cierre** y sobre **lo que pasa después de un
`finished` que nadie confirmó**. Esto lo precisa, como ADR-009 precisó RN-02 y
RN-04 sin tocar ADR-004.

## Decisión

1. **RN-03 rige mientras el partido está en juego, y no sobrevive al cierre.**
   En la transición a `finished` —la confirme la fuente o la fuerce RN-02 a
   kickoff + 120— se publica el marcador de la **observación ganadora** (RN-01),
   no el retenido. Si no hay observación fresca, se publica el vigente. Letra
   nueva de RN-03, que es la que `reglas.md` pasa a decir (forma por peso desde
   el 2026-09-29, ver la nota fechada al final de §1):
   > **RN-03 — Monotonía.** **Mientras el partido está en juego**, un marcador
   > solo lo baja una fuente con más peso que la que lo subió; hoy, el operador: un
   > gol que sube el operador no lo baja API-Football. Si una fuente que no pesa más
   > propone un marcador menor que el vigente, se mantiene el vigente y se abre una
   > Alert. **La retención no sobrevive al cierre: al pasar a `finished`, manda el
   > marcador de la observación ganadora.**

   No se reordena RN-06: RN-03 simplemente no tiene nada que decir en el cierre.
   El cierre **no resuelve** la alerta `regression` que quedó abierta (eso es
   EPIC-004): deja de propagar su error, nada más.

   *2026-09-29, Alberto Fojo (titular), cierra F-SPEC-012-3:* RN-03 pasa de
   «salvo por el operador» a su forma general **por peso**. Con «mismo peso» la
   regla degenera con una sola fuente automática —la que sube y la que baja es
   la misma— y en `eibar-las-palmas` se habría publicado 43 min un marcador
   falso (`hallazgos-jornada.md`, hallazgo 2). «Más peso» coincide hoy con la
   letra anterior (solo el operador baja) y generaliza sin reescribir la
   constitución cuando entre una segunda fuente automática. Gol anulado en vivo:
   la fuente propone menos, se retiene con Alert `regression` y el operador lo
   confirma (EPIC-004); sin operador, el anulado se ve hasta el cierre y §1 lo
   corrige al pitido. FOUNDATION.md recoge la misma forma.

   *2026-10-06, supersedido en parte por ADR-011:* la letra en vivo de RN-03 de
   este §1 (la cita y la nota fechada anterior) la fija ahora ADR-011 §1; la
   cláusula del cierre de §1 y §2–§4 siguen vigentes.
2. **RN-12 — Reconciliación posterior al cierre.** Un partido cerrado
   `provisional` por el cierre forzoso de RN-02 admite **una corrección del
   marcador** cuando la fuente publica por fin su resultado final, sin volver a
   `live` y sin cambiar de estado. La Decision lleva `rule: RN-12` y cualificador
   `confirmado`. Nada más vuelve de `finished`. Letra nueva, en la sección de
   motor de `reglas.md`:
   > **RN-12 — Reconciliación tras cierre forzoso.** Un partido cerrado por el
   > cierre forzoso de RN-02 acepta el marcador final que la fuente confirme
   > después, mientras su ventana siga abierta. Solo cambia el marcador y el
   > cualificador, nunca el estado, y se registra con regla `RN-12`.
3. **El cierre forzoso no saca al partido de su ventana, y no hace falta umbral
   nuevo.** `isInWindow` devuelve hoy `false` en cuanto existe una Decision
   `finished` (`src/ingest/window.ts`), así que el tick deja de observar en el
   instante del cierre forzoso —**+120**— **treinta minutos antes** del borde que
   ADR-002 §2 ya le da (`WINDOW_AFTER_MINUTES = 150`). Ese atajo es lo que perdió
   el dato de los dos partidos. Se corrige: un `finished` **provisional por cierre
   forzoso** no saca al partido de la ventana; lo sacan el borde de tiempo (+150)
   o el `finished` que la fuente confirme, lo que antes ocurra. Un `finished`
   **confirmado** sigue cerrando la ventana al instante, como hoy.

   *2026-10-06, SPEC-014 CA-9:* «`finished` confirmado» es cualquier `finished` sin la marca `forced_finish`, tenga el cualificador que tenga; no el cualificador `confirmado`.
   - **La ventana de ADR-002 §2 no se toca**: sigue siendo
     `[kickoff − 10 min, kickoff + 150 min)`. Sin umbral nuevo, sin excepción a
     RN-08, y el criterio 2 de EPIC-002 se sigue midiendo con la misma consulta.
     Lo único que cambia es dejar de salirse de la ventana antes de tiempo.
   - Coste: **cero peticiones extra** en el caso normal —el partido clavado en el
     90 sigue saliendo en la llamada `live=` que el tick ya hace— y como mucho
     30 min más de tick despierto por los partidos que la fuente no cierra.
   - Si 30 min no bastan, subir `WINDOW_AFTER_MINUTES` es un botón visible y
     medido; no una regla nueva.
4. **`--contrastar` (SPEC-009 CA-5) sigue siendo la auditoría de jornada**, a
   mano y fuera de toda ventana. No se automatiza dentro del tick.

## Consecuencias

### Positivas
Sobre la jornada medida, §1 arregla **5 de las 7** discrepancias por replay, sin
tocar el comportamiento en vivo. **Las dos retenciones que acertaron no se
rompen**: en `eibar-las-palmas` y `barakaldo-aviles` el marcador del proveedor al
cierre ya coincidía con el publicado, y por eso no están entre las 7. §2 y §3
atacan las 2 restantes y, sobre todo, hacen que **el dato exista en el almacén**
la próxima vez: si se perdieron es porque dejamos de mirar. El motor sigue siendo
puro y replayable.

### Negativas / follow-ups
- **RN-12 exige migración.** `decisions.rule` lleva
  `check (rule in ('operator','RN-01','RN-02','RN-03','RN-05'))`
  (`supabase/migrations/20260920220153_append_only_logs.sql:52`) y
  `DecisionRule` está cerrado en `src/model/vocab.ts`. Es la primera migración de
  EPIC-002 desde el esquema base.
- **§3 es una hipótesis y se dice como tal**: que la fuente confirme el final
  entre **+120 y +150** **no se puede validar con el dato guardado**, precisamente
  porque dejamos de observar ahí. Se mide en la jornada siguiente —cuántos de los
  cierres forzosos se confirman dentro de la prórroga— y, si no bastan, la salida
  es subir `WINDOW_AFTER_MINUTES` o corregir por la ronda `ids=` de §4.
- **Un error de la fuente que llegue justo en el cierre ahora se publica**: RN-03
  ya no lo tapa. Es el precio, aceptado a la vista del dato (6 retenciones malas
  contra 0 aciertos que §1 rompa).
- **RN-08 no se toca**, y conviene decirlo porque parece que sí: la ventana
  declarada sigue siendo la misma y el criterio 2 de EPIC-002 («fuera de ventana
  ni una petición») se mide con la misma consulta. Lo que se corrige es un atajo
  del código, no la cortesía.
- **No sustituye a la segunda fuente (RN-04) ni al operador**, que siguen siendo
  la solución de fondo en EPIC-004.
- **Los 2 partidos de la jornada medida no se arreglan por replay nunca**: no hay
  observación con el marcador bueno (SPEC-009 N-9). Corregirlos es un acto
  posterior con el dato de hoy del proveedor, y eso lo especifica SPEC-013.

## Alternativas consideradas

- **Aceptar una bajada tras N confirmaciones seguidas.** Rechazada: **refutada
  por el dato**. Aciertos con 46 y 87 confirmaciones, peor fallo con 3.
- **RN-03 por mismo peso** (baja la fuente que lo subió o una igual).
  Rechazada el 2026-09-29: con una sola fuente automática equivale a derogar
  RN-03 en vivo. Se adopta la **regla del peso** («más peso que la que lo
  subió»), ver la nota fechada de §1.
- **Derogar RN-03.** Rechazada: publicaría el parpadeo de la fuente en vivo, que
  es lo único que RN-03 sí evita, y 2 de 8 retenciones acertaron en vivo.
- **Esperar al operador (EPIC-004).** Rechazada: deja 7 de 39 marcadores mal
  durante toda la épica y pone la corrección en manos de una persona un sábado,
  contra la promesa 5 de `vision.md`.
- **Segunda fuente automática (RN-04).** No rechazada: **aplazada**. Es el
  arreglo de fondo, pero es EPIC-004 y no llega a tiempo de cerrar EPIC-002.
- **Automatizar `--contrastar` como ronda `ids=` fuera de toda ventana**, en vez
  de alargar la ventana. Rechazada como camino principal: es más barata, pero
  deja el dato **fuera** del almacén —corrige sin Observation que lo sostenga— y
  abre una excepción a RN-08. Se conserva como §4, a mano.
- **Alargar `WINDOW_AFTER_MINUTES` más allá de 150 para todos los partidos.**
  Rechazada **por ahora**: gasto sin causa medida. Solo los de cierre forzoso
  tienen algo pendiente que oír, y primero hay que ver si 30 min les bastan.
