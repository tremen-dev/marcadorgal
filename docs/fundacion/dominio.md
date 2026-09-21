# Dominio y lenguaje ubicuo — marcador.gal

> Glosario canónico. Estos términos NO se traducen ni se anglicizan en código,
> UI ni documentación. Si un término falta, se añade aquí antes de usarse.
> En código los identificadores van en inglés (`Observation`, `Decision`); en
> docs se usan tal cual, sin traducir.

| Término | Definición | Notas |
|---|---|---|
| **Competition** | Una competición en una temporada y un grupo. Ej.: Tercera RFEF, 2026-27, grupo 1. El `name` es la forma galega para mostrar en todas las lenguas. | Id estable: `tercera-rfef-g1`. La temporada va aparte. |
| **Team** | Un equipo con nombre federativo en `name` (forma corta con siglas) y `shortName` opcional para filas compactas (decisión 2026-09-21). | "UD Ourense" ≠ "Ourense CF". Los filiales se distinguen por su sufijo. |
| **Match** | Un partido: competición, jornada, kickoff, local, visitante. | Id derivado del calendario declarado: sobrevive a cambios de hora. |
| **Xornada** | Jornada: el conjunto de partidos de una competición con el mismo número de ronda. | La pantalla principal se llama Xornada. Puede abarcar viernes a lunes. |
| **Source** | Una fuente de datos registrada: id, tipo (`pull` o `push`), competiciones que cubre, prioridad por competición, cadencia permitida, base legal (anotada, no evaluada). | Vive en `src/sources/registry.ts`. D-4, D-7. |
| **SourceAdapter** | El contrato que implementa cada fuente: obtener crudo, parsearlo a Observations, resolver equipos. | Puro en `parse`/`ingest`. Nunca escribe en base de datos. |
| **Raw capture** | La respuesta cruda de una fuente, guardada antes de parsear. | Storage con retención de 30 días. D-6. |
| **Observation** | Lo que una fuente dice de un partido en un instante: estado, marcador, minuto. Inmutable, append-only. | Referencia a su raw capture. RN-07. |
| **Decision** | Lo que se publica de un partido: estado, marcador, minuto, cualificador, regla aplicada y observaciones que la sostienen. Append-only; la última por partido es la vigente. | Solo la escribe el motor. D-5. |
| **Motor de decisiones** | Función pura que, dada la Decision vigente y las Observations recientes, devuelve la nueva Decision o nada. | `src/decide/`. RN-01..RN-06. |
| **Prioridad** | Número entero por (fuente, competición). Mayor gana. El operador tiene la máxima. | Configuración, no código. |
| **Alert** | Registro de que el motor no pudo publicar con confianza: conflicto, retroceso, silencio. | Tabla `alerts`. La ve el operador, nunca el público. |
| **Operador** | La persona que corrige o completa marcadores desde el panel. Entra como fuente `operator`. | Nunca edita Decisions a mano. D-5. |
| **Ventana** | Intervalo en que un partido merece sondeo: de kickoff − 10 min a kickoff + 150 min, o hasta `finished`. | Fuera de ventana el tick no llama a nadie. |
| **Tick** | Una ejecución de la ingesta: recorre las fuentes `pull` con partidos en ventana, guarda crudo, parsea, inserta Observations y ejecuta el motor. | Disparado por pg_cron cada 30 s y por Vercel Cron cada minuto como respaldo. |
| **Board** | La proyección de solo lectura que ve el público: Decision vigente por partido, unida a equipos y competición. | Vista SQL. Lo único que lee la web. |
| **Estado de partido** | Uno de cinco: `scheduled` (Programado), `live` (En xogo), `finished` (Rematado), `postponed` (Aprazado), `suspended` (Suspendido). | El descanso no es un estado: es un momento dentro de `live`. |
| **Cualificador** | Matiz de una Decision: `confirmado`, `provisional` (una sola fuente no oficial), `sen_sinal` (live sin datos en 15 min). | Siempre con etiqueta textual junto al color. |
| **Frescura** | Tres relojes que no se mezclan: el **del dato** (`decided_at`), el **de la fuente** (`observed_at` más reciente) y el **del navegador** (última respuesta recibida). | D-9. Solo el de la fuente va en la fila. El del navegador va fuera de la tabla. |
| **Calendario declarado** | Lista de partidos por competición y temporada, en JSON versionado en `data/calendario/`. Es la autoridad sobre qué partidos existen. | Se carga en Postgres; se corrige editando el JSON. |
| **Alias** | Nombre con que una fuente llama a un equipo, mapeado a nuestro `Team`. Por fuente y temporada, en `data/alias/`. | Todo-o-nada: sin alias resuelto, la observación queda pendiente y alerta. |
