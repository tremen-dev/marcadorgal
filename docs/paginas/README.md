# Páginas explicativas

Dos páginas HTML autocontenidas que cuentan el mismo sistema a dos lectores
distintos. No se sirven: viven aquí para que no se pierdan y para que envejezcan
con el repositorio. Si alguna vez se quieren publicar en `marcador.gal`, mover a
`public/` es una decisión de producto, no de dónde guardar un fichero.

Las dos usan los tokens reales de `src/design/tokens.ts` —los mismos colores,
Geist y Geist Mono— y respetan D-8: ningún estado se comunica solo con color.
La tipografía la cargan de Google Fonts, así que fuera de línea caen a la pila
de respaldo y se leen igual.

| Fichero | Para quién | Qué cuenta |
|---|---|---|
| `anatomia-jornada.html` | Alberto dentro de seis meses, o quien entre al código | El recorrido de una jornada y **por qué** el sistema tiene esa forma. Dos diagramas: el flujo del tick y la línea de tiempo de la ventana. |
| `todo-o-futbol-galego.html` | Alguien de fuera, no técnico, que valora asociarse | Qué hueco llena el producto, qué sigue hoy y qué hay por debajo, sin una palabra de arquitectura. |

## Lo que hay que mantener a mano

Ninguna de las dos la genera nada: si el sistema cambia, hay que venir a
cambiarlas. Los puntos que envejecen antes:

- **`anatomia-jornada.html`** — los umbrales dibujados en la línea de tiempo
  (`−10`, `+120`, `+150`), los diez minutos del semáforo, las cinco clases de
  alerta y la tabla de números de la jornada, que sigue con huecos hasta que
  SPEC-009 los llene.
- **`todo-o-futbol-galego.html`** — el aviso de «en construcción» de la cabecera,
  que deja de ser cierto el día que se abra la pantalla pública (EPIC-003); el
  recuento de equipos y partidos, que cambia cada temporada; y la recreación del
  marcador, etiquetada como tal a propósito porque **no** es una captura.

La fuente de verdad de todo lo que cuentan es `docs/fundacion/como-funciona.md`.
Si las dos discrepan, manda el documento; y si el documento discrepa del código,
manda el código.
