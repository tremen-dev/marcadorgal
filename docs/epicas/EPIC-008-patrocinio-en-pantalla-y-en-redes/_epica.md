---
id: EPIC-008
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-producto}
---
# EPIC-008 — Patrocinio en pantalla y en redes

## Objetivo
Que un patrocinador pueda comprar una jornada o acompañar a un equipo y eso
se vea, sin tocar el dato ni la promesa de «una sola pantalla». Es la épica
que EPIC-006 dejó fuera («pintar el patrocinio será otra épica»): allí salió
el precio (30 a 100 €/jornada, 1.000 €/temporada por competición, H-12);
aquí, qué recibe quien paga. **Nace aparcada** (titular, 2026-11-09): sin
visitas medidas no se puede pedir un precio alto. Se desbloquea en dos pasos:
el titular decide medir cuando el tráfico se note (EPIC-007, campañas), y con
la cifra en la mano se aprueba y se pinta.

Dos productos, y **cada patrocinador solo aparece en las piezas de su nivel**:

| Pieza | Jornada | Equipo |
|---|---|---|
| Franja superior y nombre de la jornada (título y `<title>`) | sí | no |
| Etiqueta de texto en la fila del equipo («con X») | no | sí |
| Tweet de gol del equipo que marca | no | sí |
| Tweet de gol encajado o de gol anulado | no | no |
| Tweet de final de partido | no | sí |
| Tweets de apertura y de resumen de la jornada | sí | no |
| Imagen al compartir el enlace | sí | no |
| Permanencia en el archivo `/xornada/[fecha]` | sí | sí |
| Informe posterior con cifras agregadas | sí | sí |

## Criterios de éxito
1. **Una jornada real patrocinada** muestra franja, nombre, imagen al
   compartir y archivo, en gl y es, sin ninguna petición a dominios de
   terceros y sin empeorar la primera pintura medida en SPEC-026.
2. **Niveles sin mezcla.** La tabla de arriba se cumple pieza a pieza con dos
   equipos patrocinados jugando entre sí y un patrocinador de jornada.
3. **Mención garantizada.** Todo partido de un equipo patrocinado produce al
   menos un tweet con su patrocinador (el de final), también en un 0-0; ningún
   gol encajado ni anulado lo lleva. Sin duplicados y dentro del tope diario
   de X.
4. **Informe reproducible.** Un comando da, por jornada, cargas de Xornada,
   pico de conexiones, clics de salida e impresiones en X, solo con agregados
   (EPIC-006 H-1: logs de Vercel, sin Vercel Analytics).
5. **Alta sin desplegar.** Dar de alta, programar o retirar un patrocinador
   no exige tocar código; sin patrocinador, la pantalla queda como hoy.
6. **Se reconoce como publicidad.** Toda pieza patrocinada lo dice con
   palabras («ofrecida por», «con»), nunca solo con color (D-8).

## Alcance
- Dentro: las piezas de la tabla; medición de audiencia sin datos de quien
  mira, que es el primer entregable y el que abre la épica; redirección
  propia para contar clics; imagen al compartir por jornada (genérica si no
  hay patrocinador; lo ya compartido no se refresca, y los tweets propios
  enlazan la jornada fechada); el patrocinio de equipo se formula como «X
  segue ao equipo», no como patrocinio del club.
- Fuera (aparcado a propósito, no por descuido):
  - Contactar, negociar, firmar y facturar: lo hace el titular (D-7).
  - Apuestas (EPIC-006 H-3) y todo formato con cookies, scripts de terceros
    o segmentación (no-negociable).
  - Patrocinar la pastilla «GOL» o cualquier señal de estado.
  - Color o peso distinto para el equipo patrocinado: `--marca` ya distingue
    a los gallegos y el color es estado.
  - Tweet de inicio de partido: gasta tope diario y aporta poco.
  - Patrocinio por competición en pantalla: ya tiene precio (EPIC-006, B),
    pero se pinta después de jornada y equipo.
  - Refrescar vistas previas ya compartidas: no depende de nosotros.
  - Castellano en X (D-2: la cuenta publica en galego).

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo (lo autora sdd-arquitecto): medición de audiencia e
informe; ADR del patrocinio (dónde vive, excepción a D-8 para franja y
etiqueta); franja, nombre y archivo; etiqueta de equipo; imagen al compartir;
tweets patrocinados (amplía EPIC-007, que dejó fuera final y resumen).

## Riesgos
- **Audiencia insuficiente.** Con CPM de 20 a 25 € (EPIC-006, informe C1 y
  C5), 35 € equivalen a unas 1.400 a 1.750 cargas por jornada y 100 € a 4.000
  a 5.000. *Hipótesis orientativa, no umbral.*
- **Nombre de los clubes.** Celta o Dépor tienen patrocinadores propios;
  asociar otra marca a su nombre puede traer una queja. Base legal: titular.
- **Tope diario de X** (50 o 100 posts en 24 h vía Buffer): los tweets de
  final y de jornada se suman a los de gol.
- **Identidad.** `vision.md`: «No un medio». La franja ocupa sitio de
  partidos en móvil; por eso es fina y estática.
- **Arrastre de la imagen.** La raíz cambia de patrocinador cada semana y X o
  Facebook pueden mostrar unos días la anterior. Se avisa en el contrato.
- **EPIC-007 sin cerrar.** Los tweets patrocinados dependen de su publicador.

## Preguntas para el titular
- **H-1. Franja o banner.** Se propone franja fina (40 a 48 px en móvil) con
  logo de una tinta, texto y enlace. ¿O un banner de imagen más alto?
  EPIC-006 H-2 y H-4 ya admiten sitio importante y logotipo.
- **H-2. Exclusividad.** EPIC-006 H-14 dice «sin exclusividad». ¿Sigue así,
  o el patrocinador de jornada veta a los de equipo de su sector esa semana?
- **H-3. Umbral de desbloqueo.** ¿Qué cifra de cargas por jornada abre la
  épica, y cuándo se empieza a medir (EPIC-006 H-11 lo dejó para más adelante)?
- **H-4. Precio del equipo.** EPIC-006 no lo estudió. ¿Por jornada o por
  temporada, y desde cuánto?
- **H-5. Cuántos equipos.** ¿Un patrocinador por equipo sin límite de
  equipos, o un máximo por jornada para no llenar la pantalla de etiquetas?
