---
id: SPEC-018
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-018 Partido sin directo: prórroga de la ventana, sen_sinal en scheduled y línea del informe

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-018-partido-sin-directo-prorroga-de-la-ventana-sen-sinal-en-scheduled-y-linea-del-informe`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | letra en `docs/fundacion/` (sdd-arquitecto, a5139bf); test del implementador 15d6bfb | `src/arch/reglas-rn05.test.ts` (7): RN-05 = etiqueta + cita de ADR-013 §2, nota `*Enmendada el … por ADR-013.*`, Ventana contiene la cita de §1, Cualificador con `sen_sinal` en `live` o `scheduled` con kickoff pasado, RN-06 intacta. `src/arch` 8 ficheros / 78 tests verdes, ninguno adaptado | | ❌ |
| CA-2 | `src/ingest/constants.ts` (`EXTENSION_AFTER_MINUTES = 360`, `EXTENSION_POLL_MINUTES = 5`) · `src/ingest/window.ts` (`isInWindow` con prórroga solo `scheduled`, `isInExtension`, `isDueForPoll` pura, `windowKickoffRange` a now − 360) · `src/ingest/db.ts` (`WindowRow.lastObservationAt` = max `received_at`) · 615b042 | `src/ingest/window.test.ts` «SPEC-018 CA-2» (i)–(v) + constantes + rango −360 · `src/ingest/db.db.test.ts` «SPEC-018 CA-2 windowMatches with the extension» (2, rollback). Adaptados a la letra nueva: «closes 150…» pasa a `live`; el rango de CA-6 (now − 150) pasa a now − 360 | | ❌ |
| CA-3 | `src/ingest/tick.ts` (filtra por `isDueForPoll`; `live=` solo con competiciones de partidos fuera de la prórroga; el barrido sigue viendo todos) · 2a50b2a | `src/ingest/tick.test.ts` «SPEC-018 CA-3» (3) con el adaptador real y `fetch` doble: tres en prórroga → `[ids=101-102-103]` sin `live=`; ninguno toca (obs. de hace 2 min) → 0 intentos, 0 peticiones, adaptador no llamado; mixto → `live=435-439` + `ids=101-201-202` (el de hace 1 min no se pide) | | ❌ |
| CA-4 | `src/decide/engine.ts` (rama RN-05 en `scheduled`: vigente `scheduled`, now ≥ kickoff + 15, todo lo fresco `scheduled` → `scheduled · sen_sinal` RN-05 citando `current.observationIds`, sin alerta; `resolve: silence` solo desde `live`) · `src/decide/thresholds.ts` (comentario) · 32dbccb | `src/decide/engine.test.ts` «SPEC-018 CA-4» (i)–(vi) (8). Adaptado a la letra nueva: «does not apply … nor outside live» → `scheduled` a +14 y `postponed` a +20 | | ❌ |
| CA-5 | `src/model/entities.ts` (`refine`: `live` o `scheduled`) · `supabase/migrations/20261006200000_spec018_sen_sinal_scheduled.sql` (única migración: `decisions_sen_sinal_check` → `status in ('live','scheduled')`) · 5c382d3 | `src/model/model.test.ts` «SPEC-018 CA-5» (acepta `scheduled`, rechaza `finished`/`postponed`/`suspended`) · `src/ingest/engine.db.test.ts` «SPEC-018 CA-5» (2, rollback: ida y vuelta por el motor + `board`, sin parpadeo, 0 alertas; check `23514` en los otros tres). i18n sin cambios | | ❌ |
| CA-6 | `src/ingest/informe.ts` (línea `sin directo y sin final: N` + `enLinea` bajo la de SPEC-017 CA-3; `sinSenal.sinDirectoNiFinal`; `prorroga()` reconstruye el tramo +150 → primera Decision no `scheduled` o +360; ese tramo es cobertura a 1 tick / 5 min y no «tras el cierre» ni «fuera de ventana»; la 2.ª línea de cobertura lo dice sin crecer) · `src/ingest/constants.ts` (comentario del techo) · 135eee3 | `src/ingest/informe.test.ts` «SPEC-018 CA-6» (9): (i) 320 `scheduled` → listado; (ii) `finished` → no (va a SPEC-017 CA-3); (iii) `postponed` (y obs. `postponed`/`live`) → no; borde +150 fuera del informe → no; prórroga con final a +200 → esperados 320 + 10 = reales, tras el cierre 0, fuera 0; sin final → 320 + 42; `live` a +150 sin prórroga; línea de cobertura; (iv) veredicto idéntico. Techo medido: 144 (HEAD ae0b30f) → **145** = `INFORME_MAX_LINEAS` | | ❌ |
| CA-7 | `src/ingest/reconciliacion-sin-directo.ts` (guarda: alias, vigente `scheduled`, fuera de ventana y prórroga; **una** captura `ids=` para los dos; crudo antes de parsear; todo-o-nada: sin `finished` de los dos no inserta; Observations + `afterInsert` en una transacción) · `tools/reconciliar-sin-directo.mjs` (en seco por defecto, lecturas `read only` + `statement_timeout 30s`) · script `reconciliar:sin-directo` · 1cc2a9c | `src/ingest/reconciliacion-sin-directo.test.ts` (6, `fetch` doble con el cuerpo de H-5 del repo, alias real 2026-27, raw store y BD en memoria) · `src/ingest/reconciliacion-sin-directo.db.test.ts` (1, rollback en local: 1 URL `ids=1572068-1612741`, `decisions` +2, `board` 3-1 y 1-0 `finished provisional RN-01`, `raw_ref` citado, 0 alertas; 2.ª ejecución rehúsa sin pedir). **Ejecución real pendiente del titular** (abajo) | | ❌ |
| CA-8 | `npm run gates` → exit 0 (typecheck, lint 0 errores / 1 warning previo en `src/arch/deploy.test.ts`, 53 ficheros / 905 tests, build) · `DATABASE_URL=…127.0.0.1:54322… npm run test:db` → 11 ficheros / 92 tests (migración aplicada en local) · `git diff ba655e0..HEAD -- package.json` = solo el script `reconciliar:sin-directo`; 1 migración | Medición de peticiones de la primera jornada tras el despliegue: **pendiente** (abajo, «CA-8 medición») | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## CA-7 — procedimiento para el titular (ejecución única, N-2)

No ejecutado por el implementador: ni petición al proveedor ni escritura en `dev`.

1. **Requisito:** migración de SPEC-018 en `dev` (con `DATABASE_URL` de `dev` en `.env`): `! npm run db:push` → aplica `20261006200000_spec018_sen_sinal_scheduled.sql`. No es imprescindible para el `finished`, pero el código que corre es el de esta rama.
2. **En seco (sin petición, sin escritura, lecturas `read only`):** `! npm run reconciliar:sin-directo` → debe listar los dos en `scheduled … RN-01`, los conteos y `petición que haría: https://v3.football.api-sports.io/fixtures?ids=1572068-1612741`.
3. **La ejecución única:** `! npm run reconciliar:sin-directo -- --aplicar` → imprime `raw_ref: raw/api-football/<día>/<now>-SPEC-018-CA-7.json.gz`, `… 1572068 finished 3-1`, `… 1612741 finished 1-0`, `board después` y `conteos después`.
4. **Comprobar (solo lectura):**
   ```sql
   begin read only; set local statement_timeout = '30s';
   select b.match_id, b.status, b.home_score, b.away_score, b.qualifier, d.rule, o.raw_ref
   from board b join decisions d on d.id = b.decision_id
   join observations o on o.id = d.observation_ids[1]
   where b.match_id in ('segunda-rfef-g1-2026-27-j5-bergantinos-coruxo',
                        'tercera-rfef-g1-2026-27-j5-barco-pontevedra-b');
   rollback;
   ```
   Esperado: `finished 3 1 provisional RN-01` y `finished 1 0 provisional RN-01`, ambos con el `raw_ref` del paso 3; `conteos después.decisions − conteos antes.decisions = 2`.
5. **Si falla** (429 de Storage, error del proveedor, un `NS` en la respuesta): no hay segunda petición sin autorización nueva. Si el fallo es tras guardar el crudo, el mensaje trae su `raw_ref` y no se inserta nada.
6. Anotar aquí: fecha, quién, peticiones (1), `raw_ref`, conteos antes/después.

| Fecha | Quién | Peticiones | `raw_ref` | Resultado |
|---|---|---|---|---|
| _pendiente_ | titular (`!`) | | | |

## CA-8 — medición de peticiones (pendiente: primera jornada tras el desplegar)

Tras la jornada, solo lectura, con `desde`/`hasta` de la jornada. Cuenta los intentos que existieron **solo** por la prórroga (ningún partido en su ventana normal en ese instante y alguno en +150..+360); las `ids=` que la prórroga añade a un intento normal no se separan (cota inferior):
```sql
begin read only; set local statement_timeout = '30s';
select date_trunc('hour', a.started_at) as tanda, count(*) as intentos,
       sum((a.details->>'requests')::int) as peticiones
from ingest_attempts a
where a.started_at between :desde and :hasta
  and not exists (select 1 from matches m where a.started_at >= m.kickoff - interval '10 min'
                    and a.started_at < m.kickoff + interval '150 min')
  and exists (select 1 from matches m where a.started_at >= m.kickoff + interval '150 min'
                and a.started_at < m.kickoff + interval '360 min')
group by 1 order by 1;
rollback;
```
Contraste: ≤ 42 por tanda de rezagados (SPEC-005 N-4). `npm run informe:jornada` da además la línea `sin directo y sin final: N` y la cobertura con la prórroga.

| Jornada | Tandas | Peticiones de la prórroga | ≤ 42 / tanda |
|---|---|---|---|
| _pendiente_ | | | |

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-018/. Informe HTML opcional: _qa/SPEC-018/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-018-1, F-SPEC-018-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-018-1** — el techo del informe queda en **145 = `INFORME_MAX_LINEAS`**, sin margen: la próxima línea exige recortar. Destino: EPIC-MANT.
- **F-SPEC-018-2** — el ritmo de la prórroga se mide con el `received_at` de la última observación del partido (la letra de CA-2). Si el proveedor omitiera el fixture en su respuesta `ids=`, no habría observación y se pediría en cada intento (hasta ~420 en 3,5 h en vez de 42). Destino: spec futura si CA-8 lo ve.
- **F-SPEC-018-3** — cobertura de la prórroga en el informe: esperada a 1 tick / 5 min; el ritmo real es 5:00–5:30 (granularidad del tick de 30 s), así que ese tramo puede leer ~91–100 %. La prórroga se reconstruye con las Decisions del informe (si no hay ninguna anterior a +150, con la vigente si se decidió antes; si no, se asume `scheduled`). Destino: revisar con la medición de CA-8.
- **F-SPEC-018-4** — el commit 32dbccb (CA-4) no es verde por sí solo: su test (ii) y el de `model.test.ts` necesitan el `refine` de 5c382d3 (CA-5). La rama en HEAD sí. Higiene, sin destino.
- **CA-7** y la medición de **CA-8** quedan pendientes de acciones del titular (arriba).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-6 y el camino de CA-7 con tests; gates y `test:db` en verde en local. Rama `ft/SPEC-018-…`, sin push.
- Falta: la ejecución única de CA-7 (titular, procedimiento arriba) y la medición de CA-8 tras la primera jornada desplegada.
- Para seguir: verificador → CA-1..CA-6 y el camino de CA-7 con dobles; tras el PR y el despliegue, el titular lanza CA-7 y se rellenan las dos tablas de arriba.
