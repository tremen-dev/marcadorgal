---
id: SPEC-044
tipo: spec
epica: EPIC-FIX
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-02, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-verificador}
---
# SPEC-044 — Recuperación de finales fuera de ventana por la rfef: herramienta de recuperación y horizonte por fuente

## Problema
**Daño activo (2026-11-02).** API-Football no dio datos en la jornada
2026-10-30/11-02 (sin plan de pago esa semana). `/api/board`, leído el
2026-11-02 por la mañana: 49 partidos, 9 `finished provisional` y **39
`scheduled` que ya se jugaron** (Tercera 9, Segunda 11, Primera 7 de 8, Primera
RFEF 6 de 10, Segunda RFEF 6 de 9); 1 de Primera se juega hoy. La pantalla
pública dice «por jugar» en 39 partidos acabados. La rfef vía explorer
(ADR-023, SPEC-038) **tiene esos finales**: el export trae 25 `FINISHED` del
10-31 y 35 `FINISHED` + 1 `POSTPONED` del 11-01, con acta (fixtures de SPEC-038
CA-1, todos con `lastSeenAt` 2026-11-01T22:58:41Z). No entran porque el tick
solo pregunta en ventana (ADR-002 §2, ADR-013), SPEC-038 CA-6 descarta lo de
fuera de ventana, y RN-01 mide la frescura por `observedAt` = `lastSeenAt`
(domingo) contra el `now` del tick (lunes). El motor sí acepta `finished` sobre
`scheduled` (SPEC-018 CA-4 (iv)). **Plazo:** antes de la jornada 2026-11-06/09
(la de observación de SPEC-039), en producción.
Esta spec ejecuta **ADR-025**: la herramienta para hoy (§6) y la regla
permanente (§1-§5) en una, porque comparten el núcleo (conjunto recuperable,
solo estados finales, motor a la hora de la observación).

## Usuarios / roles afectados
- Público: deja de ver «por jugar» en partidos acabados cuando una fuente calla.
- Titular: ejecuta `rfef:recuperar` una vez en producción (CA-8) y paga los GET a explorer.
- sdd-verificador de SPEC-039: lee `decided_at` invertidos y alertas `conflict` de la recuperación.

## Criterios de aceptación
- **CA-1 La verdad dice lo que ADR-025 fija.** `dominio.md` **Ventana** lleva la letra de ADR-025 §7; `reglas.md` **RN-08** lleva la nota de §7 con fecha, sin cambiar su letra. Test `src/arch/reglas-rn08.test.ts` (como `reglas-rn05.test.ts`): la letra de RN-08 sigue siendo la de hoy y la nota cita ADR-025.
- **CA-2 Conjunto recuperable y horizonte (puro).** `src/ingest/constants.ts`: `RECOVERY_HORIZON_HOURS = { rfef: 72 }` y `RECOVERY_POLL_MINUTES = 5`; un test exige que cada clave sea un `id` de `SOURCES`. `src/ingest/window.ts`: `isInRecovery(input: WindowInput, now, horizonHours)` y `recoveryKickoffRange(now, horizonHours)`. Tests en `window.test.ts`: (i) `scheduled` a +7 h, 72 → dentro; (ii) a +72 h → fuera; +71 h 59 → dentro; (iii) `finished` sin marca a +7 h → fuera; con marca → dentro; `postponed` → dentro; sin Decision → dentro; (iv) a +200 min (`scheduled`, en prórroga) → **no** es recuperación: ya está en ventana; (v) horizonte 0 → nunca; (vi) `isInWindow` no cambia (los casos de SPEC-013 CA-3 y SPEC-018 CA-2 siguen verdes sin tocarlos).
- **CA-3 Plan de recuperación (puro).** `src/ingest/recuperacion-rfef.ts`, sin reloj, red ni base: `planRecovery({ observations, currents, lastOwn, inCommonWindow })` → `{ insert, groups: [{ now: observedAt, matchIds }] ascendente, dropped: { live, duplicate, inWindow }, closed: [{ matchId, agrees, alert? }] }`. Reglas: solo `finished`, `postponed`, `suspended` (ADR-025 §3); una observación igual a la última `rfef` guardada del partido (`observedAt`, estado, marcador) no se inserta (§5); un partido en la ventana común no se toca (es del tick); un partido con vigente `finished` sin marca no entra en `groups`: si su marcador coincide, nada; si discrepa, un `AlertDraft` `conflict` con `details { sourceId: "rfef", observationId, current, proposed, decisionId }`. Tests sobre `export-2026-10-31.json` y `export-2026-11-01.json` con un board sintético (39 `scheduled`, 9 `finished` sin marca, 1 con marca): recuentos exactos de `insert` y `groups`, un `LIVE_PROVISIONAL` de `export-local-2026-11-01.json` → `dropped.live`, repetir el plan con `lastOwn` = lo insertado → `insert` vacío, 1 cerrado discrepante → 1 alerta y 0 ids en `groups`.
- **CA-4 Motor a la hora de la observación.** `src/ingest/engine.ts`: `decideRecovered(tx, observations, sources)` toma **un** `lockMatches` con todos los ids en orden de id y luego llama a `decideMatches(tx, ids, now = observedAt)` por instante distinto, ascendente. `AfterInsert` gana un tercer parámetro opcional `{ recovered: ReadonlySet<MatchId> }` y `createEngineHook` reparte: ventana → `now` del tick; recuperados → `decideRecovered`. `src/decide/` no cambia (`git diff --stat` vacío). Tests `engine.db.test.ts` (rollback): vigente `scheduled · sen_sinal` del domingo, observación `rfef` `finished` 2-1 con `observedAt` domingo 22:58Z, tick del lunes → Decision `finished provisional RN-01`, `scoredBy` rfef, `decided_at` = 22:58Z; repetir → 0 Decisions; `postponed` sin marcador → `postponed provisional`; dos partidos con instantes distintos → dos llamadas, un solo cerrojo (espía sobre `lockMatches`).
- **CA-5 Tick con recuperación.** `IngestDb` gana `recoveryMatches(now, horizonHours): WindowRow[]` (consulta por `recoveryKickoffRange`, filtra con `isInRecovery`) y `lastRecoveryAttemptAt(sourceId, since): Instant | null` (`details ? 'recuperacion'`, `started_at ≥ since` = now − 1 h). `runTick`: para cada fuente `pull` con horizonte > 0 y a la que le toca (§5), su intento lleva los de ventana **más** sus recuperables; los ids aceptados del intento son ventana ∪ sus recuperables (lo demás sigue en `fueraDeVentana`, SPEC-038 CA-6); las observaciones de recuperables pasan por `planRecovery` (CA-3) y van al enganche con `recovered`; `details.recuperacion = { partidos, fechas, insertadas, duplicadas, descartadasLive }` y `AttemptSummary.recovered`. Un tick sin ventana pero con recuperables **sí** corre. El barrido no recibe recuperables. Tests `tick.test.ts` con dobles: (i) ventana vacía, 60 recuperables en tres fechas → un intento `rfef` con **3** GET (uno por `?date=`), **0** intentos `api-football`; (ii) enganche llamado con `recovered` = los ids recuperables, y una observación de un partido ni en ventana ni recuperable → contada; (iii) último intento con recuperación hace 2 min → recuperables fuera, ventana igual; hace 5 min → dentro; (iv) segundo tick con el mismo export → `insertadas: 0`, `duplicadas: n`; (v) un `live` de un recuperable → `descartadasLive: 1` y no se inserta; (vi) el barrido recibe solo la ventana.
- **CA-6 Herramienta.** `npm run rfef:recuperar -- --desde <YYYY-MM-DD> --hasta <YYYY-MM-DD> [--dry-run]` (`tools/rfef-recuperar.mjs`, cáscara; consultas en `src/ingest/recuperacion-rfef-db.ts`). Fechas Europe/Madrid, inclusive, ≤ 7 días. Partidos: los del calendario declarado de las cinco competiciones con kickoff en esas fechas (`madridDateOf`). **Un** `openAttempt` `rfef` (respeta la cadencia: si sale `skipped`, reintenta hasta 90 s y, si no hay hueco, aborta sin pedir nada), **una** captura con un GET por fecha con partidos vía `ADAPTERS.rfef`, crudo guardado antes de parsear (ADR-007), `closeAttempt` con `details.recuperacion` más `{ herramienta: "rfef:recuperar", desde, hasta, dryRun, cerradosCoinciden, cerradosDiscrepan, alertas, decididas }`. Con `--dry-run`: GET, crudo e intento con `dryRun: true`, imprime el plan (partido, vigente, propuesto, acción) y **no** inserta, decide ni alerta. Sin él: `planRecovery` + inserción + `decideRecovered` + alertas en **una** transacción; imprime antes/después de `decisions`, `observations` (`rfef`) y `alerts`, y el `raw_ref`. Ninguna URL fuera de `RFEF_EXPLORER_URL` (test: el `fetch` doble registra las URL). Tests `recuperacion-rfef.db.test.ts` (rollback, `fetch` doble con los fixtures): dry-run → 0 filas nuevas salvo el intento; aplicar → Decisions esperadas; cadencia ocupada → aborta sin GET.
- **CA-7 Idempotencia.** Tras CA-6 aplicada, una segunda ejecución inmediata sobre el mismo rango: 0 observaciones, 0 Decisions, 0 alertas nuevas; un intento más. Si explorer refrescó `lastSeenAt`: observaciones nuevas y **0** Decisions (misma tupla, ADR-009 §2). Test db y consulta de gemelas (`informe:jornada`, ADR-019 §4) = 0.
- **CA-8 Ejecución real en producción, jornada 2026-10-30/11-02.** Con `DATABASE_URL` y `RFEF_EXPLORER_*` de producción en local, en este orden: (1) `--dry-run` y su salida íntegra en `_qa/SPEC-044/`; (2) aplicar; (3) consultas antes/después. Esperado: **≥ 39** partidos pasan de `scheduled` a un estado final (`finished provisional`; Tenerife–Andorra `postponed provisional`), y cada uno que falte, listado con motivo (sin fila `FINISHED` en el export, en ventana ese día); **0** gemelas; de los 9 `finished`: los sin marca **no** cambian (alerta `conflict` por cada discrepancia, con su detalle), los con marca solo por `RN-12`, listados; `observations.source_id = 'rfef'` sube exactamente en las insertadas; una fila `ingest_attempts` con `details.recuperacion` y objeto `raw/rfef/<fecha>/…`. Después, `/api/board` muestra los finales. Evidencia en el ledger: comandos, salidas, `raw_ref`, conteos.
- **CA-9 Primera jornada con horizonte (2026-11-06/09).** Del ledger de SPEC-039 o consulta propia: intentos `rfef` con `details.recuperacion` ≤ 12 por hora, ≤ 1 GET por fecha por intento, 0 intentos `api-football` con `recuperacion`, y cuántos partidos entraron por recuperación (0 es un resultado válido).
- **CA-10 Fronteras y gates.** Cambios solo en `src/ingest/`, `src/arch/`, `tools/`, `package.json` (script), `docs/fundacion/` y tests (`src/sources/rfef/` solo si hace falta; no se prevé); `src/decide/`, `src/model/`, `src/app/`, `src/components/` y `supabase/` sin diff. Sin dependencias ni migraciones. `npm run gates` → 0; `npm run test:db` en verde.

## Entidades y reglas afectadas
Ventana, Tick, Observation, Decision, Alert, Frescura (`dominio.md`); RN-01, RN-04, RN-07, RN-08 (nota), RN-09, RN-11, RN-12; D-5, D-6, D-9; **ADR-025** (lo que se ejecuta), ADR-002 §2, ADR-007, ADR-008 §7, ADR-009, ADR-010 §2, ADR-011, ADR-013, ADR-019, ADR-023 §3-§5; SPEC-038 CA-6, SPEC-012 (replay), SPEC-039.

## Fuera de alcance
- Horizonte para API-Football o en el registro (`SourceConfig`): EPIC-MANT (H-5).
- Push desde explorer (EPIC-005); cambios en explorer; cualquier petición a `marcadores.rfef.es`.
- Pintar la antigüedad de un dato recuperado o cualquier cambio en lectura pública, `src/app/` o `src/components/` (otra sesión).
- `informe:jornada`: que explique los `decided_at` invertidos de la recuperación (SPEC-039 lo anota).
- Resolver las alertas `conflict` que abra CA-8: operador (EPIC-004).

## Notas para el gate humano
- **H-1 Horizonte 72 h.** Cubre viernes → lunes y la tarde del martes. 48 h dejaría fuera un viernes caído hasta el lunes; 96 h solo añade GET. ¿72? *Resuelta por el titular (Alberto Fojo, 2026-11-02):* 72 h.
- **H-2 `decided_at` del domingo.** Las Decisions recuperadas se deciden a la hora de la observación (ADR-025 §4): honesto en los tres relojes y sin tocar el motor puro, pero `decided_at` queda anterior a `recorded_at` y a Decisions ya escritas. ADR-019 §3 lo permite. ¿Aceptado frente a declarar `observedAt` = `exportedAt` (rechazado en el ADR)? *Resuelta por el titular (Alberto Fojo, 2026-11-02):* aceptado: `decided_at` a la hora de la observación, como el replay.
- **H-3 Cierres forzosos.** Un `finished` con marca entra en el conjunto recuperable y RN-12 lo reconcilia con la rfef (`confirmado`, con prioridad 5: consecuencia ya aceptada en ADR-023). Alternativa: excluirlos y dejar solo `scheduled` y sin Decision. Recomendado: entran, y CA-8 los lista. *Resuelta por el titular (Alberto Fojo, 2026-11-02):* entran.
- **H-4 Camino, no excepción.** `rfef:recuperar` queda como herramienta permanente más allá de las 72 h (ADR-025 §6), con intento y crudo; RN-08 gana una nota. Las dos reconciliaciones anteriores fueron «únicas». ¿De acuerdo? *Resuelta por el titular (Alberto Fojo, 2026-11-02):* sí, camino permanente con nota en RN-08.
- **H-5 Dónde vive el horizonte.** Constante en `src/ingest/constants.ts` por la restricción de rutas de esta sesión; el sitio natural es el registro (RN-08: «dato del registro, no constante»). Recomendado: constante ahora, entrada de EPIC-MANT después. *Resuelta por el titular (Alberto Fojo, 2026-11-02):* constante ahora; traslado al registro por EPIC-MANT.
- **H-6 Ejecución de CA-8.** Quién (titular, con secretos de producción en local), cuándo (en cuanto se fusione, antes del 2026-11-06), rango `--desde 2026-10-30 --hasta 2026-11-02` (el partido de Primera del 11-02 está en ventana y es del tick: la herramienta lo salta). Dry-run primero, salida al ledger, y aplicar solo si el plan cuadra con los 39. *Resuelta por el titular (Alberto Fojo, 2026-11-02):* lo ejecuta el orquestador con el titular presente, hoy en cuanto se fusione; dry-run al ledger primero y aplicar solo si el plan cuadra, listando con motivo los que falten (3 de Segunda son del lunes y 1 es aplazado real).
- **H-7 Alerta por discrepancia.** La herramienta abre `conflict` sin pasar por el motor (una alerta no es una Decision: D-5 intacta; misma deduplicación que `openAlert`). ¿`conflict` o un detalle distinto? *Resuelta por el titular (Alberto Fojo, 2026-11-02):* `conflict`, abierta por la herramienta sin pasar por el motor.
- **H-8 Ritmo.** 5 min por intento con recuperación, medido sobre `ingest_attempts` de la última hora (una consulta por fuente con horizonte por tick). Alternativa sin consulta: por última observación, que con filas `SCHEDULED` de explorer preguntaría cada tick 72 h. Recomendado: por intento. *Resuelta por el titular (Alberto Fojo, 2026-11-02):* por intento.
