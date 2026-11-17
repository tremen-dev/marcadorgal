---
id: SPEC-092
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-17, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-17, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-17, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-17, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-17, por: sdd-implementador}
---
# SPEC-092 — La semana siguiente a la portada es alcanzable cuando la portada mezcla semanas

## Problema
2026-11-17 10:00Z, `/`: Segunda muestra J14 (13–16/11) y › lleva a `/xornada/2026-11-28` (J16). La semana `2026-11-21` (Segunda J15, 1ª RFEF J13, 2ª y 3ª RFEF J12) no se alcanza de ningún modo. Causa: `currentRound` elige Primera J13 (semana 21, viene de parón) y el resto en la semana 14. `homeWeek` (`src/board/weeks.ts`, SPEC-027 CA-2) = la **mayor** = 21. Las flechas de `/` salen de 21 (‹ 14, › 28) y `/xornada/2026-11-21` responde 307 a `/` (SPEC-027 H-3), que solo pinta Primera de esa semana. Reproducción pura (`data/calendario/2026-27` en afb4de8): la portada mezcla semanas cada semana, porque el miércoles unas competiciones cruzan antes que otras. Con un parón de una sola, la mezcla dura días: sin interrupción desde 2026-11-11T05:15Z hasta **2026-11-19T02:30Z**. Primero Primera va rezagada en la semana 07 (hasta el 15/11 04:45Z) y después adelantada en la 21. SPEC-027 H-3 suponía horas.

## Usuarios / roles afectados
Público (gl y es, con y sin JS): ve la siguiente jornada mientras la portada mezcla semanas.

## Criterios de aceptación
Definiciones (puras, `src/board/weeks.ts`, temporada de `now`). **Semanas mostradas** S = semanas de las rondas que elige `currentRound` por competición (ascendentes, sin repetir). **Mezcla** ⇔ |S| > 1. Una semana está **cubierta** si todas sus rondas son rondas elegidas. **Semana de la portada** H (la que es `/`): sin mezcla, `max(S)` como hoy; con mezcla, la única semana de S cubierta; `null` si hay ninguna o varias. Fixture congelado en el repo (inline o en `src/board/fixtures/`, copiado de afb4de8 con su origen anotado; nunca `data/`, SPEC-078) con las rondas del 2026-10-31 al 2026-12-05 de las cinco competiciones.
- **CA-1 Semanas mostradas y H.** Funciones puras `homeWeeks(index, now)` y `homeWeek(index, now)` (= H). Test de tabla: T1 = 2026-11-17T10:00Z → S = {11-14, 11-21}, H = 11-14. T2 = 2026-11-14T12:00Z → S = {11-07, 11-14}, H = 11-14. T3 = 2026-11-18T16:00Z → S = {11-14, 11-21}, ninguna cubierta, H = `null`. T4 = 2026-11-19T12:00Z → S = {11-21}, H = 11-21. Índice vacío → S = [], H = `null`. Los casos de SPEC-027 CA-2 sin mezcla dan el mismo H que hoy.
- **CA-2 Flechas de `/`.** `homeArrows(index, now, locale)`: con H, ‹/› = vecinas de H en `seasonWeeks` (SPEC-027 CA-2). Con mezcla y H `null`: ‹ = `min(S)` y › = la vecina siguiente de `min(S)`. Destino `/` (`/es`) solo para H. Tabla en gl y es: T1 → ‹ `/xornada/2026-11-07`, › `/xornada/2026-11-21`. T2 → ‹ `/xornada/2026-11-07`, › `/xornada/2026-11-21` (como hoy). T3 → ‹ `/xornada/2026-11-14`, › `/xornada/2026-11-21`. T4 → ‹ `/xornada/2026-11-14`, › `/xornada/2026-11-28` (como hoy). `readHome` usa `homeArrows`.
- **CA-3 Ruta.** `weekPage` responde 307 a `/` solo si la semana es H. Toda otra semana de `seasonWeeks` es página (`weekXornada`) con flechas a sus vecinas, destino `/` solo para H. Test de tabla: T1 → `/xornada/2026-11-21` es página (‹ `/`, › `/xornada/2026-11-28`), `/xornada/2026-11-14` → 307, la › de `/xornada/2026-11-07` es `/`. T3 → `/xornada/2026-11-14` y `/xornada/2026-11-21` son páginas y se enlazan entre sí. T4 → `/xornada/2026-11-21` → 307. 404 y 308 sin cambios.
- **CA-4 Todo alcanzable (propiedad).** Para cada `now` cada 15 min entre 2026-11-09T00:00Z y 2026-11-26T00:00Z, sobre el fixture: (a) siguiendo `href` de ‹/› desde `/` se llega a todas las semanas del fixture; (b) con mezcla, ninguna semana con una ronda que `/` no pinta responde 307; (c) para toda semana W ≠ H con anterior, la siguiente de su anterior es W, y desde `/` ‹ y luego › vuelve a `/` cuando H existe; (d) sin mezcla, el resultado es idéntico a las fórmulas de SPEC-027 CA-2 (`neighbourWeeks(seasonWeeks, max(S))`).
- **CA-5 e2e sin JS.** Los e2e que derivan el destino esperado de `homeWeek`/`neighbourWeeks` (`e2e/xornada-weeks.db.spec.ts`, `xornada-weeks-sen-tira.db.spec.ts`, `xornada-nav.db.spec.ts`, `xornada-goleadores-historico.db.spec.ts`) lo derivan de `homeArrows`/`homeWeek` nuevos. Tienen que pasar cualquier día, con mezcla o sin ella. Sin JS, en gl y es: el ‹ de `/` lleva a su destino y su › vuelve a `/` si H existe. Si H es `null`, la página destino tiene `week-next` hacia la otra semana mostrada.
- **CA-6 Gates y frontera.** `npm run gates`, `e2e` y `e2e:db` en verde. Sin dependencias nuevas ni migración. Los tests de `currentRound` y `currentXornada` no cambian. `git diff origin/main --stat -- src/sources src/decide src/ingest src/calendar supabase src/app/api src/components src/board/current.ts src/board/http.ts src/board/reader.ts` vacío. Versión `patch` (ADR-028): 0.11.0 → 0.11.1, o la siguiente libre.
- **CA-7 Campo.** En la primera ventana con mezcla tras el despliegue (cada miércoles por la tarde): `curl` de `https://marcador.gal/` y de los destinos de `week-previous`/`week-next`, anotados en el ledger junto a S y H calculados para ese instante. Si no hay ventana antes del cierre, el CA queda como residual con fecha.

## Entidades y reglas afectadas
Xornada, semana como clave de navegación (`dominio.md`). Enmienda SPEC-027 CA-2 (definición de `homeWeek`) y H-3 (la semana de la portada es `/` solo si `/` la pinta entera). Afecta a SPEC-072 (dónde se pintan las flechas, sin cambios). SPEC-020 CA-5, SPEC-078, ADR-014 §6 (ISR por semana, sin cambios) y ADR-028.

## Fuera de alcance
`currentRound`/`currentXornada` y qué pinta `/`; diseño de las flechas; `/api/board`. Sin mezcla, una competición con dos rondas en la semana de la portada deja una sin página: comportamiento de hoy, intacto (F-SPEC-092-1).

## Notas para el gate humano
- **H-1 Qué semana es `/` cuando hay mezcla. Recomendado: la única semana cubierta; si no hay una sola, ninguna.** (a) La propuesta inicial, «sin página para nadie y anclar en `min(S)`», arregla T1. Pero en T2, sábado con la jornada en directo, `/` daría › hacia `/xornada/2026-11-14`, una copia congelada de lo que está en directo, y ‹ hacia la semana 10-31, saltándose la 07. (b) La mayor semana (lo de hoy) es el bug. (c) La semana mayoritaria esconde durante horas, cada miércoles, la ronda jugada de la competición que cruza antes. La recomendada coincide con hoy en T2 y T4 y solo cambia cuando hoy algo es inalcanzable.
- **H-2 ‹ en mezcla.** Con H es la anterior a H (T1: semana 07, el fin de semana anterior al que se ve, no una repetición de la 14). Sin H es `min(S)`, porque tiene rondas que `/` no pinta (T3: la ronda 12 de Primera RFEF ya jugada). Recomendado.
- **H-3 ¿La página de una semana parcial enlaza a `/`?** Recomendado: no, más allá de las flechas hacia H. Sin H, ninguna flecha lleva a `/` y se vuelve con la marca (`home-link`, SPEC-081). Alternativa: una flecha extra hacia `/`, que necesita diseño (D-8).
- **N-1** Sin H (T3, miércoles), las dos semanas mostradas son snapshots ISR sin directo (SPEC-027 H-4/N-2). Un partido entre semana en directo se ve en vivo en `/` y con ≤ 10 s de retraso en su página.
- **N-2** La propuesta decía que la mezcla terminaba el 18/11 hacia las 16:30Z. Sobre el calendario real dura hasta el **19/11 02:30Z** (2ª y 3ª RFEF cruzan de madrugada).
