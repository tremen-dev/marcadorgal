---
id: SPEC-041
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-01, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-02, por: sdd-verificador}
---
# SPEC-041 — Gol reciente que pulsa

## Problema
El titular (2026-11-01) quiere ver de un vistazo qué marcador acaba de cambiar:
el número del equipo que marcó hace menos de N minutos pulsa suavemente. Hoy no
hay dato para saberlo: `PublicMatch` (ADR-014 §3) trae `observedAt` y
`decidedAt` de la **última** Decision, que cambia con cada minuto, no con el gol;
el log de Decisions (append-only, con marcador y `decided_at` por versión) sí lo
sabe, pero el público no lo lee (ADR-014 §2). Detectarlo en el cliente
comparando pintados no sirve sin JS, en la primera carga ni tras recargar.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS. Titular: migración (N-1).

## Criterios de aceptación
Sin tocar `src/sources`, `src/ingest` ni `src/decide` (puro). Decisión técnica en **ADR-022** (borrador).
- **CA-1 Instante en `web.xornada` (ADR-022).** Migración: la vista añade al final `home_scored_at` y `away_scored_at` (`timestamptz` nulables) con la regla de ADR-022 §2. `test:db`, tabla por equipo: 0-0 → 1-0 da el `decided_at` de esa Decision; Decisions solo de minuto lo conservan; 1-0 → 2-0 lo mueve; 2-0 → 1-0 (anulado) → `null`; 1-0 → 0-0 → 1-0 → el de la segunda subida; primera Decision `live` ya 1-0 → `null`; `live` 2-1 → `finished` 2-1 lo conserva; `live` 1-0 → `finished` 2-0 → `null`; sin Decision, `postponed` → `null`; el otro equipo, independiente. La lista de columnas de SPEC-020 CA-2 se actualiza; el inventario de ADR-015 §3 no cambia; el payload de `board_delta` es la fila de la vista (SPEC-024 CA-1, sigue verde). Ledger: `explain analyze` de la lectura `matches()` antes/después con 60 partidos × 150 Decisions en local, ≤ 50 ms.
- **CA-2 Contrato.** `PublicMatch` gana `homeScoredAt` y `awayScoredAt` (`Instant` nulable), no nulos solo en `live`, `finished` o `suspended`; `src/board/row.ts` los convierte (`Z`). Test: acepta y rechaza según estado; lector y payload dan el mismo objeto (SPEC-024 CA-3). En `src/model` solo cambia `public.ts`.
- **CA-3 Configuración (puro).** En `src/app/config.ts`, junto a `PROVISIONAL_DISPLAY` (patrón de SPEC-034 CA-5), van `RECENT_GOAL_MINUTES` (entero, 5) y `RECENT_GOAL_MARK` (`RecentGoalMark = "box" | "label"`, tipo exportado de `src/xornada/`, valor `"box"`). Son globales a la web, nunca por competición. La página los pasa a la pantalla y al cliente de SPEC-024. `XornadaRow` lleva los dos instantes. `recentGoals(row, now, minutes)` da, por equipo, el instante de fin o `null`: es reciente si `now < scoredAt + minutes` (H-5). Test de tabla: `null`, recién marcado, N − 1 s, exactamente N → no, `scoredAt` en el futuro → sí, otro N, ambos equipos. Test de config: valores dentro del tipo y por defecto 5 y `"box"`.
- **CA-4 Pintado en dos variantes (H-4).** En ambas, el número reciente lleva `data-recent-goal`, `xornada.recentGoal` en `srOnly` (gl «gol recente», es «gol reciente») y un pulso: keyframes de 1 s sobre `opacity`/`transform`, con tantas iteraciones como segundos queden (propiedad CSS en línea), así que se detiene al vencer también sin JS. Con `prefers-reduced-motion: reduce`, sin animación y la marca fija. `box`: recuadro alrededor del número (fondo `--bg-step`, anillo `--line-strong`, `RADIUS.sm`), sin cambiar el alto de la fila. `label`: pastilla visible «GOL» (`xornada.recentGoalLabel`, `aria-hidden`; mono 600 9 px, mayúsculas, borde `--line-strong`, `--radius-pill`, sin relleno de color) junto al número del equipo que marcó, en una pista propia de la rejilla del equipo que solo ocupa sitio cuando está; el nombre se parte si hace falta, nunca se trunca (D-2). Ninguna usa color de estado: el ember es solo `live` (ADR-005). Test de render de `MatchRow` en las dos variantes (gl/es): local, visitante, ambos, ninguno.
- **CA-5 Vence sin recargar.** Con JS, el cliente de SPEC-024 evalúa con el reloj del navegador y programa un temporizador al próximo vencimiento: a `scoredAt + N` la marca desaparece entera en ≤ 1 s, sin red. Un `PublicMatch` nuevo con el instante a `null` (anulado) la quita al pintarse; uno con instante nuevo empieza a pulsar. Sin JS, el HTML lleva la marca calculada al render (fechado por SPEC-024 CA-8). Test del reductor/temporizador con reloj doble.
- **CA-6 E2e.** La demo marca, relativo al render, un gol local de hace 1 min en un `live`, uno visitante de hace 1 min en un `finished` y uno de hace 6 min (sin marca), con el nombre más largo de la demo en un equipo marcado. Playwright en `/demo/xornada` y `/es/demo/xornada`, en cada variante (la variante se cambia en el build de prueba): a 390 y 1440 con `page.clock`, los números marcados, `animationDuration` 1 s y el texto accesible en el árbol. Con `reducedMotion: 'reduce'`, `animationName` `none` y la marca presente. Tras avanzar 5 min, sin marca. Sin JS, la marca viene servida. De 360 a 1920 px (360, 390, 1024, 1440, 1920): ni nombres truncados (`scrollWidth`, elipsis), ni pastilla o marcador fuera de la fila, ni scroll horizontal. En `box`, la fila mide lo mismo con y sin marca. `e2e:db` (polling): una Decision que sube el local lo marca en un ciclo; otra que lo baja lo quita.
- **CA-7 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde; textos de `src/i18n/` (paridad), tokens, ningún `font:` ni hex. `git diff origin/main --stat -- src/sources src/decide src/ingest` vacío; en `src/model` solo `public.ts` y su test; en `supabase` solo la migración nueva.

## Entidades y reglas afectadas
Decision, Board, Estado de partido (`dominio.md`); RN-07 (log append-only, sin
cambios); D-6, D-8, D-9. ADR-014 §2-§3 (precisado por ADR-022), ADR-005, ADR-010
(cierre), ADR-015 §3, ADR-016 (`recorded_at`, no se usa). SPEC-020 CA-2, SPEC-024
CA-1/CA-3/CA-4, SPEC-034 CA-5, SPEC-040 (margen y columnas).

## Fuera de alcance
Goleadores y minuto del gol (épica futura tras el proveedor RFEF; hoy solo
API-Football los trae); sonido o notificaciones; elegir la variante por competición.

## Notas para el gate humano
- **Resolución del titular (Alberto Fojo, 2026-11-01):** H-1: se calcula al leer, en `web.xornada` (ADR-022). H-2: `decided_at`. H-3: solo cuentan los goles vistos en directo: si la Decision y la anterior son `live`; no pulsa un partido que llega ya 1-0 ni un gol aparecido al cierre (ADR-010). H-4: las dos variantes, recuadro neutro y pastilla «GOL», elegidas por una configuración global; por defecto, `box` (CA-3, CA-4). H-5: se acepta el desfase del reloj del navegador, como en la frescura de SPEC-024 CA-8. H-6: un gol en el descuento sigue marcado tras `finished` hasta que vence la ventana.
- **N-1 Despliegue.** La migración va antes que el código: el lector y la conversión eligen campos por nombre, así que las columnas de más no rompen lo desplegado.
- **N-2** `docs/diseno/` no define movimiento ni la pastilla «GOL»: es la primera animación de la pantalla y va a revisión de diseño (D-8).
