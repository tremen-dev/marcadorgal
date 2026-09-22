---
id: EPIC-FIX
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-23, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-FIX — Fallos activos

## Objetivo

Cubo permanente para los fallos que **ya hacen daño**: los que rompen algo que
está corriendo, no los que podrían romperlo. El roadmap la nombra por su nombre
desde EPIC-MANT: «un fallo que ya hace daño no vive aquí: es EPIC-FIX y salta
la cola». Se crea el 2026-09-23 porque llega el primero de esa clase
(SPEC-011) y no había dónde ponerlo.

Salta la cola por definición: una spec de aquí se especifica, implementa y
verifica antes que el trabajo de la épica en curso, y su plazo lo pone el daño,
no el roadmap.

## Criterios de éxito

1. Cada spec de aquí nombra el daño que ya está ocurriendo, con evidencia de
   campo (comando, salida, crudo o fila de base) y con su plazo.
2. Nada entra aquí sin ese daño demostrado: un fallo silencioso que todavía no
   ha mordido es EPIC-MANT, y capacidad nueva es su épica.

## Alcance

- Dentro: fallos activos con evidencia de campo, arreglados con el cambio más
  pequeño que los arregle.
- Fuera (aparcado a propósito, no por descuido): fallos silenciosos y deuda
  (EPIC-MANT); mejoras y capacidad nueva (su épica); cualquier refactor que no
  sea el camino más corto al arreglo.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos

- Que se use como atajo para saltarse el gate de producto. Mitigación: el
  criterio de éxito 2 pide evidencia de daño, no urgencia percibida.
