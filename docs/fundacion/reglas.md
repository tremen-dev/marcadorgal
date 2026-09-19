# Reglas de negocio — marcador.gal

> Numeradas y estables: las specs y ADRs las citan como RN-xx. No se borran;
> se marcan derogadas con fecha y motivo.

## Motor de decisiones (las únicas que pueden aparecer en `Decision.rule`)

- **RN-01 — Prioridad.** Entre las observaciones de un partido con antigüedad
  menor de 5 minutos, gana la de la fuente con mayor prioridad para esa
  competición. El operador tiene siempre la prioridad máxima. A igual
  prioridad, gana la más reciente.
- **RN-02 — Transiciones.** `scheduled → live` cuando una fuente lo dice y
  el kickoff está a menos de 15 minutos. `live → finished` cuando lo dice la
  fuente ganadora, o a kickoff + 120 minutos si nadie lo cierra (con
  cualificador `provisional`). `postponed` y `suspended` solo por fuente con
  prioridad de federación o por operador. No hay más transiciones automáticas.
- **RN-03 — Monotonía.** Un marcador no baja salvo por el operador. Si la
  fuente ganadora propone un marcador menor que el vigente, se mantiene el
  vigente y se abre una Alert.
- **RN-04 — Conflicto.** Si dos fuentes de prioridad igual o adyacente
  discrepan en el marcador durante más de 3 minutos, se mantiene la Decision
  vigente y se abre una Alert. El conflicto nunca se publica.
- **RN-05 — Silencio.** Un partido `live` sin observación nueva de ninguna
  fuente en 15 minutos pasa a cualificador `sen_sinal` y abre una Alert. Al
  llegar una observación nueva, vuelve a su cualificador normal.
- **RN-06 — Trazabilidad.** Toda Decision registra la regla decisiva y los ids
  de las observaciones que la sostienen. Orden de decisión: operador > RN-03 >
  RN-05 > RN-02 > RN-01.

## Invariantes

- **RN-07 — Inmutabilidad.** Observations y Decisions son append-only. Nunca
  se actualizan ni se borran. Corregir es añadir.
- **RN-08 — Cortesía y cadencia.** Ninguna fuente `pull` se consulta más a
  menudo que la cadencia declarada en su registro, ni fuera de ventana. Toda
  petición lleva el user-agent identificado del proyecto. La cadencia es un
  dato del registro, no una constante del adaptador.
- **RN-09 — Crudo antes que parseo.** Todo adaptador guarda la respuesta cruda
  antes de interpretarla y toda Observation referencia su captura.
- **RN-10 — Identidad todo-o-nada.** Una observación solo se acepta si su
  equipo local y visitante resuelven a un único Match del calendario declarado.
  Si no, se guarda como pendiente y abre una Alert; nunca se adivina.
- **RN-11 — Frescura honesta.** La fila muestra la edad del último dato de la
  fuente redondeada a minutos. La pérdida de conexión del navegador se avisa
  fuera de la tabla y nunca cambia estado ni cualificador de ningún partido.
