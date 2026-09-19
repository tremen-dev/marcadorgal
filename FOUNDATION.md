# FOUNDATION — marcador.gal

> Constitución del proyecto. Las decisiones D-N están **locked**: solo un ADR
> aceptado puede reinterpretarlas o supersederlas. Dueños: sdd-arquitecto y
> sdd-producto (hook protege-verdad).

- Creado: 2026-09-20
- Dominio: marcador de resultados en directo de las cinco primeras divisiones
  españolas con equipos gallegos, en una sola pantalla y en galego.

## Decisiones locked

- **D-1** (2026-09-20): **Nombre e imagen propios: marcador.gal.** Inspiración
  de la desaparecida marcadorgalego.gal, no sucesión. No se usa su marca ni se
  comunica como relevo.
- **D-2** (2026-09-20): **Galego por defecto, castellano en `/es`.** Todo texto
  visible vive en ficheros de i18n desde el primer día. Los nombres de equipos
  y competiciones son los canónicos de la federación y no se traducen, abrevian
  ni truncan.
- **D-3** (2026-09-20): **Alcance v1: jornada completa de Primera División,
  Segunda División, Primera RFEF grupo 1, Segunda RFEF grupo 1 y Tercera RFEF
  grupo 1.** Los grupos son los que tienen equipos gallegos cada temporada y se
  declaran en `data/calendario/<temporada>/`. Ampliar a otros grupos o a las
  ligas territoriales exige un ADR.
- **D-4** (2026-09-20): **Toda fuente implementa el contrato `SourceAdapter`.**
  Añadir una fuente es añadir una carpeta bajo `src/sources/` con su adaptador,
  sus fixtures y su mapa de alias. Nunca una rama en el código común.
- **D-5** (2026-09-20): **Ninguna fuente publica directamente.** Solo el motor
  de decisiones escribe `Decision`. El operador humano entra como una fuente
  más, con la prioridad máxima.
- **D-6** (2026-09-20): **`Observation` y `Decision` son inmutables** y el crudo
  de cada fuente se guarda antes de parsearse. Un marcador publicado siempre
  sabe de qué observaciones sale.
- **D-7** (2026-09-20): **La base legal de cada fuente la gestiona el titular
  del proyecto fuera del código.** El registro de fuentes solo la anota. El
  código no decide qué es legal; respeta lo que el registro dice (cadencia,
  identificación, cortesía).
- **D-8** (2026-09-20): **El sistema de diseño de `docs/diseno/` es vinculante**
  para toda interfaz: densidad, dígitos tabulares, solo modo oscuro, semántica
  de color de estado, sin escudos de clubes. Las excepciones se listan en
  ADR-005.
- **D-9** (2026-09-20): **Un fallo de transporte nunca se pinta como estado del
  partido.** Los tres relojes (dato, fuente, navegador) no se mezclan ni en la
  interfaz ni en el modelo.
- **D-10** (2026-09-20): **Proceso ligero.** Un ADR cabe en una página. Un
  ledger registra evidencia, no prosa. Nada se implementa sin spec aprobada,
  pero la spec es corta y sus criterios de aceptación son verificables.

## Alcance

- **Dentro:** resultados en directo de las cinco divisiones de D-3 en una sola
  pantalla, en galego y castellano. Ingesta multifuente con contrato común,
  reconciliación por prioridad y trazabilidad. Panel mínimo de operador.
- **Fuera (v1):** clasificaciones, equipos favoritos, detalle de partido con
  eventos, notificaciones, escudos, ligas territoriales gallegas, estadísticas,
  comunidad, vídeo, apuestas. Viven en el roadmap, no en la v1.

## No-negociables

- **Un marcador no baja** salvo por el operador (RN-03).
- **Los conflictos no se publican: se alertan** (RN-04).
- **Ninguna petición a una fuente fuera de la cadencia declarada** en su
  registro (RN-08).
- **Sin cookies, sin analítica de terceros, sin datos de quien mira** la
  pantalla pública.
- **El código de `src/sources/*` solo importa de `src/model`.** Un test de
  arquitectura lo comprueba.

## Cómo se trabaja aquí

Este proyecto sigue el estándar **tremen-sdd**: nada se implementa sin una
SPEC aprobada; las decisiones técnicas se registran como ADR inmutables; la
evidencia de verificación vive en el ledger de cada spec. Roles: /sdd-orquestador
(entrada), /sdd-producto, /sdd-arquitecto, /sdd-implementador, /sdd-verificador,
/sdd-documentalista, /sdd-como-vamos.

Documentación, specs, ADRs y commits en **castellano**. Código, identificadores
y comentarios en **inglés**. Texto visible al usuario en **galego** (D-2). Los
términos de `docs/fundacion/dominio.md` no se traducen.
