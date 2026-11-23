---
id: SPEC-094
tipo: spec
epica: EPIC-MEJORA
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-23, por: Alberto Fojo}
---
# SPEC-094 — Los goleadores siempre cuadran con el marcador

## Problema
El marcador sale de la Decision (motor, `web.xornada`). Los goleadores, no: en directo los añade `enrichMatchesWithGoals` (`src/lib/explorer-enrichment.ts`) al leer, desde el export de explorer, y en `/directos` y el femenino vienen de explorer tal cual. Son dos relojes: explorer puede listar un gol antes de que el motor suba el marcador, o el motor retenerlo (RN-03, RN-04). Nada comprueba que cada lado sume lo que dice su marcador, así que un 1–0 puede pintar dos goleadores, o ninguno en un lado. Además, `sanitizeGoals` descarta en silencio los goles sin `minute`, y el contrato del tick (`ExplorerGoal`, `src/sources/rfef/explorer.ts`) exige `minute`: un solo gol sin minuto en el export rechazaría el export entero de esa fecha. Trazado a `4a646b5`.

## Usuarios / roles afectados
Público (xornada, competición, `/directos`, gl/es): lee goleadores que suman lo que dice el marcador. Titular: el informe de `historico:sync`.

## Criterios de aceptación
Vitest sin red (funciones puras y `renderToStaticMarkup`); Playwright solo sobre `/demo/xornada` y `/es/demo/xornada`. «Lado» = `goal.team`, también en propia puerta: `team` es el equipo al que sube el gol (fixture `export-2026-10-31-celta-fortuna-cordoba.json`: Albacete 2–1 con dos `ownGoal` en `home`).
- **CA-1 (cuadre puro)**: `squareGoals(goals, score)` en `src/xornada/scorers.ts` (puro: sin reloj, red ni React) devuelve, por lado, una lista de líneas `{kind:"scorer", goal}` o `{kind:"unknown"}`. Dado `score` nulo, entonces los dos lados salen vacíos, traiga goles o no. Si no, para cada lado (también con la lista vacía o ausente) con `N = score[lado]`: los goles conocidos se ordenan por `minute` ascendente (a igual minuto, orden de llegada) y después los sin minuto, en orden de llegada; (a) con más de N, quedan los N primeros; (b) con menos de N, tras ellos van tantas `unknown` como falten. Siempre `lineas(lado).length = N`. Un caso por regla, incluidos: 2–1 sin ningún goleador (dos y una `unknown`), 1–0 con dos goleadores locales, 2–1 con un goleador, 0–0 en `live` con un gol listado, un lado sin goleadores y el otro con todos, y un `ownGoal`.
- **CA-2 (el pintado solo pinta el cuadre)**: `MatchRow` y `DirectosView` pasan a `TeamGoals` las líneas de `squareGoals` (con `row.score` y con `homeScore`/`awayScore` respectivamente) y `TeamGoals` no pinta nada más. Una fila tiene cajón (`data-has-goals`, plegado, `aria-controls`) si y solo si algún lado tiene goles en el marcador, haya o no goleadores conocidos; un lado con 0 no emite bloque. Dado un 1–0 con dos goleadores locales, entonces hay exactamente un `goal-line` local (el de menor minuto). La marca reciente (SPEC-068 CA-4) va en la última línea de la lista cuadrada.
- **CA-3 (línea sin autor)**: Una línea `unknown` es un `goal-line` con `data-unknown="true"`, `goal-minute` vacío (la columna conserva su ancho) y en `goal-player` el texto de `xornada.goalUnknown` (`gl.ts` y `es.ts`: «gol»), sin `goal-kind`. Se distingue por el texto, no por el color: mismos tokens que el nombre (`--fg-muted`, `--sans`).
- **CA-4 (gol sin minuto)**: `sanitizeGoals` conserva el gol con `minute` ausente, nulo o no numérico, sin clave `minute`; sigue descartando el autor sintético («goleador …»), el `team` inválido y el `player` vacío. `PublicGoal.minute` pasa a opcional en `src/model` (y `TransformedGoal`, el tipo de `explorer-client.ts` y `ExplorerGoal`, este como `nullable().optional()`). Dado un export de fixture con un gol sin minuto, entonces el `parse` del tick no lo rechaza y da las mismas `observations` que sin ese gol. En el pintado, su `goal-minute` está vacío, sin `'`, y la línea va tras las que tienen minuto.
- **CA-5 (`match_goals` manda y no admite huecos)**: El enriquecimiento sigue sin consultar explorer para una fila que ya trae goles. `historico:sync` solo escribe la lista de un partido si cada gol tiene minuto y cada lado suma su marcador; si no, no toca `match_goals` y el partido sale en «Goles incompletos» del informe, que dice cuántos goles válidos y cuántos sin minuto. Test con plan en memoria; la tabla no cambia (sin migración).
- **CA-6 (demo)**: `demoMatches` añade, en filas que hoy no tienen goles, un lado con menos goleadores que goles, un lado con más y un gol sin minuto; y conserva un partido con goles en el marcador y sin ningún goleador (Sevilla 2–1 Getafe). Playwright a 360 y 1440 px en gl/es: en cada fila desplegada, incluida la de Sevilla, los `goal-line` de cada lado suman su marcador y la línea «gol» se lee en el idioma de la ruta; una fila sin goles en el marcador (0–0 o sin empezar) no gana cajón. **Expectativas que cambian** (H-1): `e2e/xornada-goleadores.spec.ts` usa Sevilla 2–1 (`NO_GOALS`) como «fila sin goles que no gana nada» (CA-5 de SPEC-068); pasa a esperar cajón con 2 + 1 líneas «gol», y el caso de fila sin cajón se hace con una fila sin goles en el marcador. En `src/components/xornada/goals.test.ts` (`mockRow` lleva 1–2), «emits no block for a team without goals» y «renders no block nor interactive role when the row has no goals» pasan a esperar líneas «gol», y el caso sin bloque se prueba con marcador nulo o 0–0. El resto de e2e pasa sin tocar sus expectativas.
- **CA-7 (gates)**: `npm run gates` y `npm run e2e` en verde; sin hex sueltos ni shorthand `font:`.

## Entidades y reglas afectadas
Decision (el marcador manda; RN-03, RN-04 sin cambios: `src/decide` no se toca), D-5, D-8, D-9, ADR-005 (nada solo por color), ADR-014 §3 (`PublicGoal`), ADR-034, SPEC-059, SPEC-060, SPEC-068 (CA-1, CA-2 y CA-4 se precisan: el bloque pinta la lista cuadrada), SPEC-069 (enums cerrados, sin cambio). ADR-028: `minor` (feat).

## Fuera de alcance
- Supabase Realtime (`applyDelta`): apagado, con precondición en ADR-036. Como el cuadre está en el pintado, un delta también saldría cuadrado; no se prueba.
- Elegir qué goleador sobra con criterio distinto del minuto, o cruzar `homeScoredAt` con la lista: la fuente no da ids de gol.
- Avisar del descuadre (log o alerta): con el cuadre en pantalla, no hay daño que vigilar; el de `match_goals` ya lo cuenta el informe (CA-5).
- `match_goals.minute` nullable: con CA-5 no hace falta migración.
- `aria-label` de la fila y anuncio de goleadores por lector de pantalla (como SPEC-068).

## Notas para el gate humano
1. **H-1 — partido sin ningún goleador conocido: cerrada (titular, 2026-11-23): «Sí, siempre».** Toda fila con goles en el marcador muestra su cajón, con líneas «gol» donde falte autor, también si el enriquecimiento se corta a los 2 s o la división no da autores. Consecuencia: casi toda fila con goles gana cajón y afordancia, y cambian expectativas de SPEC-068 (CA-6).
2. **Dónde vive el cuadre.** En el pintado (`src/xornada/scorers.ts`, lo importan los componentes), no en la lectura: cubre servidor, sondeo de `/api/board`, `/directos`, femenino y demo con una función, y los datos públicos siguen diciendo lo que dijo la fuente.
3. **CA-4 toca el tick.** Hoy ningún fixture trae un gol sin minuto, pero si explorer lo manda, el contrato vigente rechaza el export entero de la fecha. Se relaja solo `minute` del gol; el tick no usa goles.
4. **Línea «gol».** Igual en galego y castellano. Sin maqueta en `docs/diseno/`; usa la línea de SPEC-068 sin minuto.
