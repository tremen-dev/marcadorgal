---
id: SPEC-068
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-09, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-09, por: sdd-verificador}
---
# SPEC-068 — Goleadores colgados de su equipo en la fila de partido

## Problema
El cajón de goleadores de `MatchRow` (SPEC-056) y la caja de goles de `/directos` (`DirectosView`, SPEC-055 CA-3) fallan en cinco puntos (revisión de diseño, 2026-11-09): (1) repiten el nombre del equipo en mayúsculas bajo sí mismo; (2) un emoji ⚽ por gol, de color ajeno a los tokens y distinto por plataforma (D-8); (3) el minuto va detrás del nombre y, con el nombre completo de la fuente, cae solo a la línea siguiente (SPEC-056 CA-2 lo pedía delante); (4) «(p.)» y «(p.p.)» en ámbar, que ADR-005 reserva a lo que espera a una persona; (5) un 2–1 ocupa seis líneas más un filete. El titular eligió el diseño «goleadores colgados de su equipo»: la posición atribuye el gol. Esta spec **supersede SPEC-056 CA-2** y **precisa CA-1** (`aria-controls`; el clic dentro de los goleadores, que hoy `handleToggle` ignora, pasa a conmutar) y **CA-3** (qué línea es la reciente); lo demás de SPEC-056 sigue vigente sin cambio de comportamiento.

## Usuarios / roles afectados
- Público (móvil y escritorio, gl/es): lee quién marcó y cuándo bajo cada equipo, en la mitad de alto.

## Criterios de aceptación
Marcado: bloque `data-testid="team-goals"` (`data-team`, `id="goals-{matchId}-{home|away}"`); línea `goal-line` (`data-team`, `data-recent`) con hijos `goal-minute`, `goal-player` y, si procede, `goal-kind`. Vitest sobre `renderToStaticMarkup`; Playwright sobre `/demo/xornada` y `/es/demo/xornada`, a 360 y 1440 px.
- **CA-1 Cada lista cuelga de su equipo.** Dado un partido con goles, cuando se renderiza `MatchRow`, entonces dentro de `.sides` cada bloque va justo después del marcador de su equipo (el local, antes del nombre visitante) y un equipo sin goles no emite bloque. La fila no contiene «⚽», ni `data-testid="match-goals"`, ni el nombre de un equipo fuera de sus dos `team-name` y del `aria-label` (Vitest). Desplegada, el bloque local queda entre los dos nombres, el visitante bajo el suyo, y ningún bloque tiene borde (Playwright).
- **CA-2 Minuto delante, nombre íntegro, orden por minuto.** Dado un bloque, entonces cada `goal-line` trae primero `goal-minute` con `{minute}'` y después `goal-player` con `player` tal como llega (sin abreviar, truncar ni cambiar de caja); las líneas van por `minute` ascendente (a igual minuto, orden de llegada) aunque lleguen desordenadas (Vitest). En navegador, el minuto usa `--mono`, `tabular-nums` y `--fg-muted`, alineado a la derecha en una columna de ancho fijo (todos los `goal-minute` de una fila comparten ancho y borde derecho); el nombre usa `--sans` y también `--fg-muted` (la jerarquía la da mono frente a sans). Un nombre que no cabe a 360 px parte dentro de su columna y el minuto sigue en la primera línea (mismo borde superior, ±1 px).
- **CA-3 Penalti y propia puerta en gris.** Dado un gol con `penalty` u `ownGoal`, entonces tras el nombre va `goal-kind` con el texto de `xornada.goalPenalty` («(p.)») o `xornada.goalOwnGoal` («(p.p.)»), claves de `gl.ts` y `es.ts` (Vitest); su color computado es `--fg-muted` y su `font-style`, `normal` (Playwright).
- **CA-4 Goleador reciente.** Dado `recentGoals(...)` no nulo para un equipo (SPEC-041), entonces solo la última línea de su bloque tras el orden de CA-2 lleva `data-recent="true"` y, tras el nombre, la pastilla `recent-scorer-badge` con `xornada.recentGoalLabel` (Vitest); su nombre se pinta en `--fg`; la pastilla conserva `animationIterationCount = pulseIterations(until, clock)`, deja de marcarse al vencer `until` sin recargar y no anima con `prefers-reduced-motion: reduce` (Playwright).
- **CA-5 Plegado como en SPEC-056.** Dada una fila con goles, entonces los bloques salen del servidor con `data-expanded="false"` y alto 0; la fila conserva afordancia, `role="button"`, `tabIndex`, `aria-expanded`, `aria-label` y la activación por clic, Enter y Espacio; `aria-controls` lista, separados por espacio y en orden de DOM, los `id` de los bloques presentes, y cada uno resuelve a un único elemento. Al conmutar, todos los bloques cambian a la vez con transición de `grid-template-rows` entre `0fr` y `1fr`. Un clic en cualquier punto de la fila conmuta, también dentro de un bloque desplegado: dada una fila desplegada, cuando se pulsa sobre un `goal-line`, entonces `aria-expanded` pasa a `false` y los bloques a `data-expanded="false"` (Playwright). Una fila sin goles no gana atributos ni bloques.
- **CA-6 La fila plegada mide lo mismo que hoy.** Dada una fila con goles plegada, en las dos variantes de `RECENT_GOAL_MARK` (puertos 3100 y 3101), cuando el test retira los bloques del flujo (`display: none`), entonces el alto de la fila y la posición vertical de los dos nombres y los dos marcadores no cambian (0 px). Los e2e existentes pasan sin tocar sus expectativas.
- **CA-7 `/directos` pinta igual.** Dado un partido con goles en `DirectosView`, entonces los de cada equipo van bajo su `teamLine`, siempre visibles y sin interacción (como hoy), pintados por el mismo componente que usa `MatchRow`: para los mismos goles, el HTML de cada `goal-line` es idéntico en las dos vistas. Desaparecen `goalsBox`, su filete y el emoji (Vitest).
- **CA-8 La demo lleva goleadores.** `demoMatches` da `goals`, coherentes con el marcador, al menos en: una fila `finished` con goles de los dos equipos, un penalti y un gol en propia puerta; una fila con goles de un solo equipo; un nombre que no cabe en una línea a 360 px; y el goleador de la fila `live` con gol reciente de SPEC-041 CA-6. Siguen existiendo filas sin `goals`.
- **CA-9 Reglas de la casa y gates.** Sin hex sueltos ni shorthand `font:`; no quedan en los CSS las clases del diseño anterior (`goalsTeams`, `teamGoalsCol`, `teamGoalsName`, `teamGoalsList`, `goalPill`, `goalPenalty`, `goalsBox`, `goalItem`); `npm run gates` y `npm run e2e` en verde.

## Entidades y reglas afectadas
- `MatchRow.tsx`, `Xornada.module.css`, `DirectosView.tsx`, `DirectosView.module.css`, un componente de lista compartido bajo `src/components/`, `src/i18n/{gl,es}.ts`, `src/xornada/demo.ts`, `goals.test.ts`, `DirectosView.test.ts`, un e2e nuevo.
- `PublicGoal`, `XornadaRow.goals`, `TransformedGoal`: se leen, no cambian. D-8, ADR-005, SPEC-041, SPEC-042, SPEC-055, SPEC-056.

## Fuera de alcance
- Cronología única con parcial tras cada gol: el parcial es dato derivado y no cuadra si la lista llega incompleta.
- Línea compacta con apellidos («Sánchez 68' · Fores 86'»): la fuente solo da el nombre completo.
- Cambios en `PublicGoal`, en la ingesta o en el enriquecimiento (SPEC-059).
- Plegado en `/directos`, e2e de `/directos` (lee explorer por red) y cómo anuncia los goleadores un lector de pantalla (la fila sigue siendo un botón con `aria-label`, como en SPEC-056).

## Notas para el gate humano
- **`aria-controls`:** lista de ids. Un contenedor común obligaría a envolver también los nombres, porque los bloques se intercalan con ellos en `.sides`.
- **Precisión a SPEC-056 CA-3:** «último gol» pasa a ser la última línea tras ordenar por minuto. El enriquecimiento ya ordena: nada visible cambia.
- **`/directos`** se verifica solo por marcado; lo visual lo hereda del componente compartido.
- **La demo gana goleadores (CA-8):** hoy no tiene y es la única página que Playwright abre sin red.
- **Contraste (titular, 2026-11-09):** minuto y anotación van en `--fg-muted`, no en `--fg-dim`, para cumplir WCAG AA: `--fg-dim` a 11 px daba ≈ 3,8:1 sobre `--bg`; `--fg-muted` da ≈ 7,7:1 (cálculos a mano).
- **Clic dentro del bloque (titular, 2026-11-09):** conmuta, como en el resto de la fila (CA-5).
- **Maqueta:** `_qa/SPEC-068/maqueta-goleadores-fila.html`, variante A. Es orientativa; lo normativo son los CA. Es anterior a la enmienda de contraste: pinta minuto y «(p.)» en `--fg-dim`.
