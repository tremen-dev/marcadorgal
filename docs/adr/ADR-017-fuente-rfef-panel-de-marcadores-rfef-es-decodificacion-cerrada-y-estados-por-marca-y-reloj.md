---
id: ADR-017
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
---
# ADR-017: Fuente rfef: panel de marcadores.rfef.es, decodificación cerrada y estados por marca y reloj

- Deciders: sdd-arquitecto propone (2026-10-10) para EPIC-004, aprobada por **Alberto Fojo**, que ya fijó: prioridad 50 que manda también en directo, las cinco competiciones, calendario en API-Football y legal fuera (D-7). Pendiente: la aprobación y H-1..H-4.
- Specs relacionadas: SPEC-031 (adaptador y parser) y las siguientes de EPIC-004. Si se aprueba H-2, supersede **solo** la adyacencia de ADR-009 §5. Evidencia: `EPIC-004/_qa/sondeo/`, capturas del 2026-10-10 entre las 20:49Z y las 21:47Z.

## Contexto
`marcadores.rfef.es` es PNFG (Novanet), sin API ni login. Medido: sin cookie,
`NFG_CMP_Paneles` responde 302 a `NLogin`; con la `JSESSIONID` que da la portada,
responde 200 a un **GET** con los parámetros en la URL. Con `federacion=3`, una
respuesta (146 KB, 11 KB en gzip, ISO-8859-15) trae las cinco competiciones, del
grupo gallego cuando hay grupos, más Copa y juveniles. Cada grupo lleva `codgrupo`
(Tercera G1 = 26991073). Cada fila trae «Jornada N», día y hora locales sin año, y
los nombres. No trae minuto. Los escudos no identifican al equipo: un club y sus
filiales comparten el mismo. El marcador llega ofuscado con tres técnicas y
señuelos `display:none`. Comprobado: `ntype(id,n,i,f)`, empaquetado, pone la
clase `fa-<d[i*10+n]>`; en Font Awesome 6.5.1, `.fa-N::before` es el dígito N; y
los `::before`/`::after` traen el dígito literal o como `\003N`, a veces con
`display:none`. La marca naranja (`parpadea`) **no** significa «en juego»:
Real Madrid–Villarreal (kickoff 19:00Z) la seguía teniendo a las 21:47Z (kickoff + 167 min). Celta
Fortuna, del mismo horario, la perdió y siguió sin acta.

## Decisión
1. **Petición.** En cada intento: un GET a la portada para obtener la sesión, sin
   seguir redirecciones (la cookie nunca va al crudo), y **un** GET a
   `NFG_CMP_Paneles?cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3`.
   El cuerpo se decodifica con el charset de `content-type`. Al crudo va solo la
   segunda petición. En el registro: `minIntervalSeconds: 30` y el user-agent del
   proyecto.
2. **Identidad.** Grupo → competición por `codgrupo`, en un mapa `competitions`,
   nuevo y opcional, de `AliasFile` (`data/alias/<temporada>/rfef.json`). Los grupos
   fuera del mapa se ignoran, sin alerta. Equipo → `teamId` por nombre normalizado
   (recortado, espacios colapsados, minúsculas, NFC), que hace de `externalId`.
   Partido: `(competición, local, visitante)` en el calendario declarado, que el
   núcleo inyecta igual que el alias (ADR-008 §8). Ese trío es único por temporada.
   La «Jornada N» de la fila debe coincidir con `round`; si no,
   `inconsistent_alias`. RN-10, sin cambios.
3. **Decodificación cerrada.** Por cada lado se calcula lo que pintaría un
   navegador (`::before` + texto + `::after`, sin lo que tiene `display:none`), sin
   `eval`: `ntype` se desempaqueta como texto. Solo se aceptan las formas de nodo y
   CSS conocidas. La función desempaquetada tiene que tener la forma exacta de hoy,
   y su tabla, 40 dígitos. Cada lado tiene que dar `^\d{1,2}$`. Si falla cualquier
   fila, **la petición entera** va a `requestErrors`: el intento sale `ok = false`
   y no hay ninguna observación. Con un único GET, la fuente se calla, y a los
   5 min (RN-01) vuelve a mandar API-Football.
4. **Estados.** La RFEF solo habla cuando sabe: nunca emite `scheduled`. El
   kickoff es el día y la hora de la fila en Europe/Madrid, con el año más próximo
   a `capturedAt`.

   | Fila | Observación |
   |---|---|
   | sin marcador (`-`) | ninguna |
   | marcador y `verPartido(acta)` (acta cerrada) | `finished` |
   | marcador sin `parpadea` y `capturedAt ≥ kickoff + 100 min` | `finished` |
   | marcador con `parpadea` y `capturedAt` en `[kickoff − 10, kickoff + 110)` | `live`, minuto `null` |
   | marcador en cualquier otro caso | `skipped: ambiguous_state` (motivo nuevo) |
   | «Aplazado» | `postponed` |
   | «Suspendido» (sin marcador) | `skipped: missing_score` (H-3) |
   | otro texto | `skipped: unsupported_status` |
5. **Prioridad 50** en las cinco competiciones. Con 50, `settle` ya publica
   `confirmado`, sin código nuevo.
6. **Crudo antes que parseo**, como en ADR-007 §6: ~11 MB/día en gzip a 1.000 ticks.
7. **Fixtures y oráculo.** El parser se prueba con capturas reales. Un test de
   Playwright pinta cada fixture sin red, con las reglas `.fa-N` en línea, y exige
   que el texto visible de cada marcador sea el que da el parser.

## Consecuencias
### Positivas
Una petición de datos por tick cubre las cinco competiciones. Si la RFEF cambia la
ofuscación, la fuente falla a la vista (`tick:salud`) y no publica un dígito falso.
Mientras la RFEF calla manda API-Football, sin intervención.
### Negativas / follow-ups
- **Sin minuto**: mientras gane la RFEF, el minuto publicado es `null` (H-1).
- Con prioridad 50, la latencia del gol es la de la RFEF aunque API-Football lo dé
  antes (criterio 3, sin medir).
- `parpadea` y la falta de acta salen de **una noche** de capturas, y todavía no
  se ha visto un partido de Tercera en juego. SPEC-031 exige capturas de una
  jornada antes de cerrar la tabla (H-4).
- Hoy la RFEF (50) y API-Football (10) son adyacentes: RN-04 retendría cada
  discrepancia de más de 3 min (H-2).

## Alternativas consideradas
- **Ficha por partido** (`NFG_CmpPartidoEnJuego`): 530 KB y una petición por
  partido, y tampoco trae minuto.
- **`Sch_en_juego=1`** (23 KB): no trae las actas cerradas, que son la
  confirmación.
- **Ejecutar el JS** en un sandbox o en un navegador headless: ejecuta código ajeno
  dentro del tick y se traga en silencio cualquier ofuscación nueva.
- **Identificar por escudo o por `CodActa`**: los filiales comparten escudo, y la
  fila en juego no trae acta.
- **`parpadea` → `live` sin reloj**: deja en juego, con prioridad 50, partidos
  acabados hasta el cierre forzoso.

## Preguntas al titular
- **H-1 Minuto.** (a) Recomendada: una spec del motor. Si la ganadora da `live`
  con `minute: null`, se publica el minuto de la observación fresca más
  prioritaria que lo tenga. (b) Publicar sin minuto mientras mande la RFEF.
- **H-2 RN-04 entre bandas.** (a) Recomendada: la adyacencia solo cuenta dentro de
  una banda (1-49 proveedores, 50-99 federación). Entre bandas manda RN-01, sin
  retener y sin alerta, y el informe de jornada cuenta las discrepancias.
  (b) Lo mismo, con alerta `conflict` informativa.
- **H-3 «Suspendido» sin marcador.** (a) Recomendada: la RFEF calla y decide
  API-Football. (b) Cambiar el modelo para admitir `suspended` sin marcador.
- **H-4 Captura de campo.** Autorizar una serie de `federacion=3` cada 2 min
  durante una jornada (el domingo 11 o la siguiente), para fixtures y para medir
  la latencia de publicación.
