---
id: SPEC-041
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
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
- **CA-3 Ventana configurable (puro).** `RECENT_GOAL_MINUTES` en `src/app/config.ts`, junto a `PROVISIONAL_DISPLAY` (SPEC-034 CA-5): entero, valor 5, pasado por la página a la pantalla y al cliente de SPEC-024. `XornadaRow` lleva los dos instantes; `src/xornada/` exporta `recentGoals(row, now, minutes)` → por equipo, el instante de fin o `null`: reciente si `now < scoredAt + minutes` (H-5). Test de tabla: `null`; recién marcado; N − 1 s; exactamente N → no; `scoredAt` en el futuro → sí; N = 5 y otro N; ambos equipos.
- **CA-4 Pintado (H-4).** El número reciente lleva `data-recent-goal`, un recuadro (fondo `--bg-step`, anillo `--line-strong`, `RADIUS.sm`, sin cambiar el alto de la fila) y, para lectores, `xornada.recentGoal` en `srOnly` (gl «gol recente», es «gol reciente»). Pulso: keyframes de 1 s sobre `opacity`/`transform` del recuadro, con tantas iteraciones como segundos queden (propiedad CSS en línea), así que se detiene al vencer también sin JS. Con `prefers-reduced-motion: reduce`, sin animación y el recuadro fijo. Sin color de estado: ember sigue siendo solo `live` (ADR-005). Test de render de `MatchRow` (gl/es): reciente local, visitante, ambos, ninguno.
- **CA-5 Vence sin recargar.** Con JS, el cliente de SPEC-024 evalúa con el reloj del navegador y programa un temporizador al próximo vencimiento: a `scoredAt + N` desaparecen atributo, recuadro y texto en ≤ 1 s, sin red. Un `PublicMatch` nuevo con el instante a `null` (anulado) lo quita al pintarse; uno con instante nuevo empieza a pulsar. Sin JS, el HTML lleva la marca calculada al render (fechado por SPEC-024 CA-8). Test del reductor/temporizador con reloj doble.
- **CA-6 E2e.** La demo marca, relativo al render, un gol local de hace 1 min en un `live`, uno visitante de hace 1 min en un `finished` y uno de hace 6 min (sin marca). Playwright en `/demo/xornada` y `/es/demo/xornada`, 390 y 1440, con `page.clock`: los dos números marcados, `animationDuration` 1 s, texto accesible en el árbol; con `reducedMotion: 'reduce'`, `animationName` `none` y recuadro presente; tras avanzar 5 min, sin marca; sin JS, marca servida. `e2e:db` (polling): una Decision que sube el local lo marca en un ciclo; otra que lo baja lo quita. A 360-1440 px sin truncado ni scroll horizontal; mismo alto de fila con y sin marca.
- **CA-7 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde; textos de `src/i18n/` (paridad), tokens, ningún `font:` ni hex. `git diff origin/main --stat -- src/sources src/decide src/ingest` vacío; en `src/model` solo `public.ts` y su test; en `supabase` solo la migración nueva.

## Entidades y reglas afectadas
Decision, Board, Estado de partido (`dominio.md`); RN-07 (log append-only, sin
cambios); D-6, D-8, D-9. ADR-014 §2-§3 (precisado por ADR-022), ADR-005, ADR-010
(cierre), ADR-015 §3, ADR-016 (`recorded_at`, no se usa). SPEC-020 CA-2, SPEC-024
CA-1/CA-3/CA-4, SPEC-034 CA-5.

## Fuera de alcance
Goleadores y minuto del gol (épica futura tras el proveedor RFEF; hoy solo
API-Football los trae); sonido o notificaciones; fecha por fila (SPEC-040).

## Notas para el gate humano
- **H-1 De dónde sale el instante.** **A (recomendada) — derivado en `web.xornada` del log de Decisions** (ADR-022): sin columna ni escritura nueva, motor e ingesta intactos. B — columna escrita por el motor al decidir: toca `src/ingest`/`src/decide` (vetado ahora). C — solo en cliente: falla sin JS, en la primera carga y al recargar.
- **H-2 Qué reloj.** Recomendado `decided_at` de la Decision que subió el marcador: el mismo para todos y el más cercano a cuándo lo ve el público. `observed_at` (reloj de la fuente) acortaría la ventana en la latencia (~50 s); `recorded_at` es solo para medir (ADR-016).
- **H-3 Solo subidas vistas en directo.** Recomendado: cuentan si esa Decision y la anterior son `live`. Efecto: no pulsa un partido que llega ya 1-0, ni un gol aparecido al cierre (ADR-010).
- **H-4 Aspecto.** Recomendado recuadro neutro + pulso + texto accesible; ninguno depende del color. Alternativas: ember (ADR-005 lo reserva al estado `live`, y un `finished` puede tener gol reciente) o una palabra visible «gol» (no cabe en la columna de 30 px del marcador en móvil).
- **H-5 Reloj del navegador.** Uno desfasado alarga o acorta la ventana, como la frescura de SPEC-024 CA-8. Recomendado aceptarlo.
- **H-6 `finished`.** Recomendado: un gol en el 90+4 sigue marcado tras el pitido hasta que vence la ventana.
- **N-1 Despliegue.** Migración antes que el código: el lector y la conversión eligen campos por nombre, así que columnas de más no rompen lo desplegado.
- **N-2** `docs/diseno/` no define movimiento: es la primera animación de la pantalla; va a revisión de diseño (D-8).
