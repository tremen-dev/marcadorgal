---
id: SPEC-025
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-09, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-10-09, por: sdd-implementador}
---
# SPEC-025 — Medición de latencia gol → pantalla con segundo reloj y sonda sintética

## Problema
Criterio 3 de EPIC-003: latencia gol → pantalla (mediana y p95) con mejor
referencia que SPEC-009 (+53,2 s, n = 15, radio a minuto: R-SPEC-009-6) y
desglosada con un segundo reloj (R-SPEC-009-7). Hoy un solo `now` sella todo
(ADR-008 §7) y nadie mide la pantalla. Camino en producción (polling, SPEC-024
H-6): gol → proveedor → captura (tick 30 s) → Observation → Decision →
`/api/board` (`s-maxage=10`, ETag) → pantalla (polling 30 s ±20 %).

## Usuarios / roles afectados
- Titular: aprueba ADR-016 y la migración; anota la calibración (H-1); decide objetivo, cadencia o fuente con el informe (criterio 3).
- sdd-verificador: verificación de campo y con fecha (N-2). Público: ninguno (sin cookies ni datos de quien mira).

## Criterios de aceptación
- **CA-1 Segundo reloj (ADR-016).** Migración: `ingest_attempts.opened_at` y `decisions.recorded_at`, nulables, añadidas sin default y luego `set default clock_timestamp()`. `.db.test`: tras migrar, las filas previas siguen `null`; un intento y una Decision nuevos las tienen no nulas y `recorded_at ≥ opened_at` del intento que trajo la observación citada; ninguna aparece en `web.xornada` ni en el payload de `board_delta`. `git diff main -- src/model src/decide` vacío.
- **CA-2 Referencia del proveedor, cero peticiones (H-1).** `src/sources/api-football/events.ts`, puro: de un cuerpo crudo saca, por partido, los eventos `Goal` (sin `Missed Penalty`) en orden, con su intervalo `[inicio, fin)` = inicio del periodo (`fixture.periods`) + minuto (`elapsed`, `extra`) a resolución de 60 s. Lee crudo ya guardado (`live=` e `ids=` del tick, ADR-007; retención 30 días): **ninguna petición nueva**. Test con `live-2026-09-26.json` y casos de tabla (primera parte, segunda, añadido, sin `periods` → sin intervalo y motivo).
- **CA-3 Sonda de pantalla (H-2).** `MatchRow` añade `data-version`. `tools/sonda-pantalla.mjs` (Chromium de `@playwright/test`, sin dependencias nuevas) abre `https://marcador.gal/` y `/es` a 390 px, contexto nuevo sin almacenamiento, y escribe JSONL: por cada cambio de `[data-match-id]` (MutationObserver + `requestAnimationFrame`), `matchId`, `version`, marcador, estado, `paintedAt` (reloj de la sonda, ISO `Z`); por cada respuesta de `/api/board`, estado 200/304, `Age`, `x-vercel-cache`, `Date` y el instante local. Cada minuto registra `visibilityState` (debe ser `visible`). Parser puro `src/medicion/sonda.ts` con test sobre un JSONL de fixture. `.github/workflows/sonda-pantalla.yml`: `schedule` en los bloques de la jornada y `workflow_dispatch` (`horas` ≤ 5,5); sube el JSONL como artefacto.
- **CA-4 Tramos, cada uno en su reloj (D-9).** `src/medicion/latencia.ts` puro (sin reloj ni red) une, por gol, referencia ↔ primera Decision cuyo total de goles es k (el k-ésimo `Goal`) ↔ primera pintura con `version` ≥ la suya. Tramos: (a) **muestreo** = primera observación con el gol − última sin él (`observed_at`, reloj del tick); (b) **petición + crudo** = `storage.objects.created_at` − `opened_at`; (c) **parse + inserción + motor** = `recorded_at` − `created_at` (b y c, reloj de la base); (d) **entrega** = `paintedAt` − `recorded_at`, junta base ↔ sonda, partida en `Age` (CDN, duración) y espera de polling; (e) **total** = `paintedAt` − referencia. Juntas impresas: desfase tick ↔ base (mediana `opened_at − started_at`), base ↔ sonda (cabecera `Date`, ±1 s) y residuo (suma de tramos − total). Test de tabla con un gol sintético por tramo, gol sin pintura, sin referencia y anulado (bajada RN-03): ninguno se descarta en silencio.
- **CA-5 Informe y escenarios.** `npm run informe:latencia -- <desde> <hasta> --sonda <jsonl…> [--calibracion <csv>]` → `_qa/SPEC-025/latencia-<fecha>.md`, una página: n por competición y por referencia; por tramo mediana, p95 (o `peor caso (n=…)` si n < 20, regla de SPEC-009 CA-3) y máximo; total contra 45 s y 90 s; calibración manual contra el intervalo del proveedor (sesgo y dispersión). **Escenarios proyectados** (fórmulas fijadas aquí, antes de medir): polling actual (medido); Realtime = total − (d) + 5 s (cota de SPEC-024 CA-10, laboratorio); Realtime + tick a 15 s = lo anterior − 7,5 s, con peticiones/día ×2 frente al presupuesto de SPEC-005 N-4. Test del Markdown con un `Informe` sembrado.
- **CA-6 Campo.** En la primera jornada tras el merge (N-2), la sonda corre en todos los bloques con partidos en juego; `informe:latencia` se genera y el ledger recoge mediana, p95 o peor caso con su n, cada tramo, juntas, escenarios y veredicto `cumple`/`no cumple` por objetivo. Si no cumple, el ledger lo dice y la épica queda esperando la decisión escrita del titular (H-4); esta spec no cambia cadencia, fuente ni objetivo.
- **CA-7 Gates.** `npm run gates`, `test:db` y `e2e` en verde (la e2e sin JS de SPEC-019/020 acepta `data-version`). Sin dependencias nuevas. `git diff main --stat -- src/decide src/ingest` vacío (las lecturas viven en `src/medicion/latencia-db.ts`, con su `.db.test`). Ningún test pide a la red ni al proveedor.

## Entidades y reglas afectadas
Observation, Decision, Tick, Board, Frescura, Raw capture (`dominio.md`); RN-08,
RN-09, RN-11; D-6, D-9. ADR-008 §7, ADR-016, ADR-007 §5, ADR-014 §6, ADR-002 §7.
SPEC-009 CA-2/CA-3 y N-10, SPEC-017, SPEC-024 (CA-7, CA-10, H-6).

## Fuera de alcance
Primera pintura en 3G (SPEC-026). Encender Realtime o cambiar cadencia, fuente
u objetivo (decisión del titular, H-4). Medir Realtime en producción (H-3).
Analítica de visitantes.

## Notas para el gate humano
- **H-1 Referencia.** Recomendado: proveedor (minuto + `periods`, error 0-60 s, todos los goles con eventos, **0 peticiones**) como principal, y **calibración manual** del titular con segundos (radio FM en directo del propio partido, no carrusel; reloj del móvil sincronizado), ≥ 8 goles con al menos 3 de Primera o Segunda: ~2 tardes de su tiempo. Alternativa: solo manual con n ≥ 20 (4-5 tardes). Pedir `/fixtures/events` aparte: rechazado, los eventos ya vienen en el crudo.
- **H-2 Sonda en GitHub Actions.** El repo es público: minutos gratis; jobs de ≤ 6 h; ~4 peticiones/min a `/api/board`, despreciable. La lanza el `schedule` (sin nadie); `workflow_dispatch` para huecos. Alternativa: el Mac del titular (gratis, pero se duerme).
- **H-3 Realtime proyectado, no medido.** Medirlo exige habilitar `board_delta` en producción en Free, contra SPEC-024 H-6. Recomendado: proyección con la cota de 5 s; se mide en la jornada publicada (Pro).
- **H-4 Si no se cumple:** el informe da tramo dominante y escenarios; el titular elige por escrito (objetivo, cadencia —×2 peticiones— o fuente) y eso cierra el criterio 3. Recomendado.
- **N-1 Una página, al límite.** Por eso la primera pintura va en SPEC-026 y el segundo reloj en ADR-016.
- **N-2 Fecha.** La jornada 2026-10-09/12 queda fuera (no hay código). Primera candidata: 2026-10-16/19. Las herramientas se repiten en la jornada publicada.
- **Decididas por el titular (Alberto Fojo, 2026-10-09):** H-1 = minuto del proveedor + inicio de parte, calibrado con ≥ 8 goles anotados por el titular con segundos; H-2 = sonda en GitHub Actions; H-3 = Realtime proyectado, no medido; H-4 según recomendación. Spec aprobada.
