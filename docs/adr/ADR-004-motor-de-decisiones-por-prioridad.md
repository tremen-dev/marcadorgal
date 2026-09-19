---
id: ADR-004
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
---
# ADR-004: Motor de decisiones por prioridad, monotonía, conflicto y silencio

- Deciders: sdd-arquitecto propone; Alberto Fojo aprueba (2026-09-20).
- Specs relacionadas: EPIC-002.

## Contexto

La versión previa tenía un motor de pesos de confianza con confirmación por
doble fuente independiente, pensado para fuentes poco fiables. Con fuentes con
acuerdo y prioridades explícitas, ese mecanismo añade complejidad sin cambiar
lo que se publica. Se eligió el término medio: prioridad más protecciones.

## Decisión

- El motor es una **función pura** en `src/decide/`: entrada = Decision
  vigente (o ninguna) + Observations de los últimos 5 minutos + instante
  actual; salida = nueva Decision o `null`. Sin reloj propio, sin red, sin
  base de datos.
- Aplica RN-01 a RN-06 de `reglas.md` en este orden de precedencia:
  operador > monotonía (RN-03) > silencio (RN-05) > transiciones (RN-02) >
  prioridad (RN-01). La regla decisiva se registra en `Decision.rule` (RN-06).
- Umbrales en un solo fichero `src/decide/thresholds.ts` con su regla al lado:
  ventana de observaciones 5 min, gracia de conflicto 3 min, silencio 15 min,
  cierre forzoso kickoff + 120 min.
- Cualificador derivado, sin columna nueva: `confirmado` si la fuente ganadora
  tiene prioridad de federación u operador o coinciden dos fuentes;
  `provisional` en otro caso; `sen_sinal` por RN-05.
- Se ejecuta en el mismo request que inserta observaciones, partido a partido,
  y escribe `decisions` y `alerts` en una transacción.
- Es **replayable**: dado el log de observaciones, reproduce el log de
  decisiones. Un test lo comprueba con una jornada de fixtures.

## Consecuencias

### Positivas
Reglas legibles en una página; cada umbral tiene un dueño; todo se prueba sin
infraestructura. Añadir una fuente no toca el motor: solo el registro.

### Negativas / follow-ups
Sin doble fuente independiente, un error de la fuente prioritaria se publica
como `provisional` hasta que otra fuente o el operador lo corrija. Aceptado:
"provisional a tiempo antes que confirmado tarde".

## Alternativas consideradas

- **Solo prioridad**: sin protección ante retrocesos ni conflictos.
- **Motor de pesos heredado (RN-01..RN-07 de la versión previa)**: más
  robusto ante fuentes dudosas, mucho más complejo, y su segunda vía nunca se
  disparó por falta de dos fuentes.
- **Motor en trigger SQL**: no testable con fixtures ni replayable fuera de
  Postgres.
