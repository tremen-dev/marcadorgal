---
id: EPIC-004
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-10-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-004 — Fuente RFEF

## Objetivo
Dar directo donde hoy hay `sen sinal`. API-Football no dio en directo 2 de 9
partidos de Tercera en J4 y 4 de 8 en J5, ni 1 de 9 de Segunda RFEF en cada
jornada (`EPIC-002/_qa/fuente-sin-directo/medicion.md`). La RFEF publica en
`marcadores.rfef.es` los partidos en juego de las cinco competiciones de D-3,
con acta provisional y cerrada. Es la fuente oficial: entra como segunda
fuente automática con **prioridad 50** (la reservada a federación en
`src/sources/registry.ts`) y manda sobre API-Football (10) en todo lo que
ambas digan. El titular decidió abrirla ya, en paralelo a EPIC-003
(2026-10-10): la segunda fuente existe y el operador no es necesario para
cubrir el hueco.

## Criterios de éxito
1. **Directo donde faltaba**: en una jornada medida, ningún partido de las
   cinco competiciones queda `sen sinal` mientras la RFEF lo publica en
   juego. Referencia: 2-4 de Tercera y 1 de Segunda RFEF por jornada hoy.
2. **Sin empeorar el dato**: la cobertura de `finished` correcta sigue en
   100 % (`vision.md`) y no aparecen marcadores falsos atribuibles a la
   RFEF (contraste con acta cerrada, con evidencia).
3. **Sin empeorar la latencia**: en los partidos donde manda la RFEF, la
   latencia gol → pantalla cumple `vision.md` (mediana < 45 s, p95 < 90 s),
   medida con el segundo reloj de ADR-016. *Hipótesis a validar*: la
   latencia de publicación de la RFEF no está medida.
4. **Cero intervenciones manuales** en esa jornada por culpa de la fuente
   nueva (alias, parseo, ofuscación).

## Alcance
- Dentro: adaptador pull `rfef` con el contrato de ADR-003 y fixtures
  reales; alias de equipos de las cinco competiciones; registro con
  prioridad 50; estados en juego, provisional, cerrada, aplazado y
  suspendido; detección de que el formato u ofuscación cambió (la fuente
  falla de forma visible, nunca con un dígito equivocado); medición de
  cobertura y latencia en una jornada real.
- Fuera (aparcado a propósito, no por descuido):
  - Operador, panel y webhooks push: pasan a EPIC-005.
  - Ligas territoriales gallegas vía Federación Galega (`federacion=3`):
    «Más adelante»; abre calendario y equipos nuevos.
  - Sustituir a API-Football como fuente de calendario: el importador
    enchufable lo permite, pero no es esta épica.
  - Fútbol femenino, sala y playa.
  - Análisis legal de la fuente (D-7: lo lleva el titular).

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo (lo autora sdd-arquitecto): ADR de evaluación de la
fuente (endpoints, sesión, ofuscación, cadencia, prioridad); adaptador y
parser con fixtures; alias de equipos; registro y alta en el tick; jornada
medida de cobertura y latencia.

## Riesgos
- **Bloqueo por IP (medido el 2026-10-11, bloquea el alta).** Tras ~5 vueltas
  (~10 min) de consultas automáticas, la RFEF responde 200 con cuerpo vacío a
  todo (portada incluida) desde esa IP, con bloqueos crecientes (8 → 16 → 30 →
  50 → 76 → 80+ min). Con la cadencia del tick (30 s) el directo es inviable.
  Decisión del titular (2026-10-11): se cierra SPEC-031 (parser) y las specs de
  alta y jornada medida esperan a un **acceso autorizado** (lista blanca de IP o
  feed) que gestiona el titular. Esquivar el bloqueo (proxies, rotación de IP)
  queda fuera: es una protección deliberada de la fuente.
  *Enmendado el 2026-10-11 (titular):* se abre en paralelo la vía de consumo
  mínimo desde una identidad estable (ADR-021, SPEC-032): el alta espera a la
  calibración de la cadencia sostenible, no solo al acceso autorizado.
- **Ofuscación del marcador.** Los dígitos llegan ofuscados (JS, CSS
  `::after`, escapes unicode). Si la RFEF la cambia, el parser puede leer
  mal en silencio: con prioridad 50 un dígito falso manda. Es el riesgo
  principal.
- **Sin API.** HTML con sesión por cookie: frágil ante rediseños.
- **Latencia desconocida** de la RFEF en directo (criterio 3).
- **Datos provisionales** hasta el cierre del acta: el directo puede
  corregirse después del pitido.
