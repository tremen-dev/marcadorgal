---
id: SPEC-060
tipo: spec
epica: EPIC-003
estado: hecho
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: implementada, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto, nota: "enmienda tras el RED del verificador (V-1..V-6) y la decisión del titular del 2026-11-09; ADR-033"}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-09, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-09, por: sdd-verificador}
  - {estado: hecho, fecha: 2026-11-10, por: titular, nota: "rebase sobre main: emparejamiento de SPEC-070 y ventana ±3 de SPEC-071; ADR-031 de la rama renumerado a ADR-033 (main ya tenía ADR-031 y ADR-032). Ver ledger"}
aprobada-por: Alberto Fojo
---
# SPEC-060 — Back-fill histórico de resultados y goleadores desde Explorer

## Contexto y Problema
Las jornadas pasadas (`/xornada/[fecha]`, `WeekXornada`) leen `web.xornada`, que no tiene goles. Además, hay marcadores mal guardados por el motor de entonces. El titular decide (2026-11-09) que **en las jornadas ya disputadas manda Explorer**, también para los goleadores (ADR-033, que precisa ADR-025 §6). `observations` y `decisions` no se borran (D-6): la corrección se **anexa**. Es una herramienta manual (`npm run historico:sync`): la lanza el titular después de revisar el dry-run, y no es periódica. El RED del 2026-11-09 (ledger, V-1..V-6) obliga a rehacer CA-2 y CA-4.

## Usuarios y roles afectados
- **Afición:** ve el marcador correcto y los goleadores (acordeón de SPEC-056) en cualquier semana pasada.
- **Titular/operador:** revisa partido a partido qué se va a corregir antes de escribir.

## Criterios de aceptación
- **CA-1 `match_goals`.** Migración con `public.match_goals` (`id`, `match_id` → `matches`, `team` ∈ {home, away}, `player`, `minute ≥ 0`, `penalty`, `own_goal`, `created_at`), índice `(match_id, minute)` y RLS activado sin políticas. Solo se lee a través de `web.xornada` (ADR-015). `src/db/schema.db.test.ts` incluye la tabla en la lista de tablas (:74) y en la comprobación de RLS (:289) (V-1).
- **CA-2 Corrección de marcadores (ADR-033 §2-§4).** `historico:sync -- [--desde] [--hasta] [--dry-run]`. Por defecto `--desde 2026-08-14` y `--hasta` = ayer (Europe/Madrid). Un `--hasta` ≥ hoy se rechaza con exit ≠ 0. Para cada fecha con partidos declarados:
  (a) abre un `ingest_attempt` `source_id = 'operator'`, guarda el crudo del export de los siete días de su ventana (SPEC-071; cada día se pide una vez por ejecución) en el raw store **antes** de parsearlo y lo cierra con `ok`, `error` y el número de observaciones;
  (b) si la fila emparejada (identidad de SPEC-070 en la ventana de SPEC-071; ambigua o sin emparejar no escribe) da `FINISHED` y la Decision vigente no existe o no es `finished` con ese marcador, inserta una observación `operator` `finished` con `observed_at` = instante de la lectura y `raw_ref` = ese crudo, y ejecuta el motor con `now` = ese instante (camino de `decideRecovered`). Resultado: Decision `operator · confirmado`, versión puesta por el trigger. **Ningún INSERT en `decisions` desde la herramienta**;
  (c) si coincide, o si Explorer no da `FINISHED`, no escribe nada.
  Test db: vigente `finished 1-1` + Explorer `FINISHED 2-1` → v2 `finished 2-1 operator confirmado`, `observed_at` ≠ kickoff, `raw_ref` legible en el store, 0 alertas. Una segunda ejecución igual escribe 0 filas.
- **CA-3 Goleadores.** Por partido, borrar e insertar los goles en la transacción de la fecha, **solo si** Explorer da `FINISHED` y los goles válidos por equipo (filtro de placeholders de SPEC-059) suman su marcador. Si no, los goles guardados no se tocan y el partido sale en el informe como «goles incompletos». Test: `LIVE_PROVISIONAL` con `goals: []` y `FINISHED 1-0` sin goles → los goles existentes se quedan (P2 de V-2).
- **CA-4 Dry-run revisable (V-5).** `--dry-run` no escribe nada (0 filas en todas las tablas) e imprime una línea por cada partido con cambio: `fecha · competición · J<round> · local–visitante · <estado y marcador guardados> → <marcador Explorer> · goles <n guardados> → <n Explorer>`. Después lista los partidos sin `FINISHED`, los sin emparejar (con su motivo), los ambiguos, los emparejados (línea de SPEC-070 CA-7, con la fecha de la fila si es otra) y los de goles incompletos, y cierra con totales por jornada (competición + round) y por competición. Test unitario del formato.
- **CA-5 Fallos visibles (V-4).** Si una fecha falla (red, proxies, respuesta inválida, o 0 partidos de Explorer en la propia fecha con partidos declarados en BD y ninguno emparejado en la ventana), su transacción no escribe nada, su intento queda `ok = false` y se pasa a la siguiente. Un 401/403 aborta la ejecución en el acto. Si falla alguna fecha, el informe final lista las fechas fallidas con su error y el exit es ≠ 0. Test: fetcher que lanza 401, y fecha vacía → exit ≠ 0 y las fechas aparecen en el resumen.
- **CA-6 Lectura pública (V-6).** `web.xornada` expone `goals` y `WeekXornada` los pinta. Playwright sobre una semana pasada con goles sembrados: el acordeón de `MatchRow` despliega autor y minuto.
- **CA-7 Gates.** `npm run gates` en verde y `test:db` sin fallos nuevos respecto a la base de `main` (con la lista de fallos ajenos en el ledger).

## Entidades y reglas afectadas
`match_goals`, `observations`, `decisions` (por el motor), `ingest_attempts`, raw store (ADR-007). D-6, D-9, RN-01, RN-06, RN-09, ADR-025 §4, ADR-033, SPEC-056, SPEC-059. Código: `src/ingest/historico*.ts`, `tools/historico-sync.mjs`, `src/board/*`, `src/db/schema.db.test.ts`.

## Fuera de alcance
- Tarjetas y cambios.
- Cambiar `src/decide/`.
- Pasar un partido a `postponed`/`suspended` desde Explorer (solo se informa).
- Fechas de hoy o futuras.
- Que `informe:*`/`salud` traten las filas `operator`: es un follow-up de ADR-033, salvo que los gates lo rompan.

## Notas para el gate humano
- Aprobar **ADR-033**: la corrección publica `operator · confirmado` lo que diga Explorer, sin alerta.
- Aprobar el criterio de «goles completos» (suma = marcador): si no se cumple, no se escriben goles parciales.
- Fecha que falla ⇒ se continúa con las demás; 401 ⇒ se aborta. Ejecución real **solo después de** revisar el dry-run contra prod.
