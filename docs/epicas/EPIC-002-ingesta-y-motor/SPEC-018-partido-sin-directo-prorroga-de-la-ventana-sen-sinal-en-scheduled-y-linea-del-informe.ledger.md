---
id: SPEC-018
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-018 Partido sin directo: prórroga de la ventana, sen_sinal en scheduled y línea del informe

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-018-partido-sin-directo-prorroga-de-la-ventana-sen-sinal-en-scheduled-y-linea-del-informe`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | letra en `docs/fundacion/` (sdd-arquitecto, a5139bf); test del implementador 15d6bfb | `src/arch/reglas-rn05.test.ts` (7): RN-05 = etiqueta + cita de ADR-013 §2, nota `*Enmendada el … por ADR-013.*`, Ventana contiene la cita de §1, Cualificador con `sen_sinal` en `live` o `scheduled` con kickoff pasado, RN-06 intacta. `src/arch` 8 ficheros / 78 tests verdes, ninguno adaptado | verificador 2026-10-06: `vitest -t SPEC-018` 7/7 en `reglas-rn05.test.ts`; diff de `dominio.md`/`reglas.md` = letra de ADR-013 §1/§2 palabra a palabra, nota `*Enmendada el 2026-10-06 por ADR-013.*` | ✅ |
| CA-2 | `src/ingest/constants.ts` (`EXTENSION_AFTER_MINUTES = 360`, `EXTENSION_POLL_MINUTES = 5`) · `src/ingest/window.ts` (`isInWindow` con prórroga solo `scheduled`, `isInExtension`, `isDueForPoll` pura, `windowKickoffRange` a now − 360) · `src/ingest/db.ts` (`WindowRow.lastObservationAt` = max `received_at`) · 615b042 · **Enmienda N-4 (d96b5bb):** `WindowInput.decidedAt` (vigente, `null` sin Decision); entre +150 y +360 siguen `scheduled`/sin Decision y `live` o `finished` con marca decididos ≥ kickoff + 150; `db.ts` lee `d.decided_at` solo para el filtro (la fila del tick no cambia de forma); `reconciliacion-sin-directo.ts` pasa `decidedAt: null` (un `scheduled` entra o sale solo por tiempo) | `src/ingest/window.test.ts` «SPEC-018 CA-2» (i)–(v) + constantes + rango −360 · `src/ingest/db.db.test.ts` «SPEC-018 CA-2 windowMatches with the extension» (2, rollback). Adaptados a la letra nueva: «closes 150…» pasa a `live`; el rango de CA-6 (now − 150) pasa a now − 360 · **Enmienda:** (iii) reescrita: `finished` sin marca (false/null), `postponed`, `suspended` a +200 → fuera; `live`/`finished` con marca decididos a +120 → dentro a +149, fuera a +150 y +200; decididos a +200 → dentro a +200 y +359, fuera a +360; borde decidido a +150 → dentro, a +149 → fuera; `scheduled` dentro sea cual sea su `decidedAt`. Rojo antes del cambio (4 fallos), verde después. `db.db.test.ts` «N-4» (4, rollback): a +200, `live`/`finished` con marca decididos ahora → en ventana; decididos a +120 → fuera; la fila no lleva `decidedAt` | verificador: `window.test.ts` (i)–(v) verdes; tests preexistentes cambiados solo donde la letra nueva lo exige («closes 150» pasa a `live`, porque un `scheduled` a +150 ya está en ventana; `windowKickoffRange` −150 → −360), ninguna aserción debilitada; `db.db.test.ts` CA-2 verde en local (11/92) · **Re-verificación N-4 (2026-10-06, HEAD d02a5c6):** `isInWindow` = letra enmendada (fuera: `finished` sin marca, `postponed`, `suspended`; dentro: `scheduled`/sin Decision, y `live` o `finished` con marca con `decidedAt ≥ kickoff + 150`; +360 fuera); (iii) cubre +120/+200/+359/+360 y el borde 150/149; SPEC-013 CA-3, SPEC-014 y SPEC-016 sin diff en sus tests y verdes. `db.db.test.ts` N-4 contra `src/` de dce3afb en worktree aparte: **2 fallos** (los «decididos ahora → dentro»), verde en HEAD: el test ejerce que `decided_at` llega a `isInWindow` | ✅ |
| CA-3 | `src/ingest/tick.ts` (filtra por `isDueForPoll`; `live=` solo con competiciones de partidos fuera de la prórroga; el barrido sigue viendo todos) · 2a50b2a · **Enmienda:** `tick.ts` sin cambios (el tick no mira el estado en la prórroga) | `src/ingest/tick.test.ts` «SPEC-018 CA-3» (3) con el adaptador real y `fetch` doble: tres en prórroga → `[ids=101-102-103]` sin `live=`; ninguno toca (obs. de hace 2 min) → 0 intentos, 0 peticiones, adaptador no llamado; mixto → `live=435-439` + `ids=101-201-202` (el de hace 1 min no se pide) · **Enmienda (520b2fe):** el primer caso lleva un `finished` con marca decidido a su +200 (hace 5 min), con `isInWindow` = true comprobado en el test → mismo `[ids=101-102-103]`, ninguna `live=`. Verde sin cambio de código | verificador: 3 tests con el adaptador real y `fetch` doble, aserciones exactas de URL (`ids=101-102-103`, 0 URLs y `adapterFor` no llamado, `live=435-439` + `ids=101-201-202`). Salvedad no bloqueante: sin observación nueva (fixture omitido, error o estado no soportado) la prórroga se pide en cada tick (F-SPEC-018-2); sigue dentro del presupuesto por tick de SPEC-005 N-4 (1 + ⌈n/20⌉) · **N-4:** `git diff dce3afb -- src/ingest/tick.ts` vacío; el caso enmendado lleva el `finished` con marca decidido a +200, `isInWindow` = true afirmado, URL exacta `ids=101-102-103` sin `live=` | ✅ |
| CA-4 | `src/decide/engine.ts` (rama RN-05 en `scheduled`: vigente `scheduled`, now ≥ kickoff + 15, todo lo fresco `scheduled` → `scheduled · sen_sinal` RN-05 citando `current.observationIds`, sin alerta; `resolve: silence` solo desde `live`) · `src/decide/thresholds.ts` (comentario) · 32dbccb · **Enmienda:** `engine.ts` sin cambios, como pide (vii) | `src/decide/engine.test.ts` «SPEC-018 CA-4» (i)–(vi) (8). Adaptado a la letra nueva: «does not apply … nor outside live» → `scheduled` a +14 y `postponed` a +20 · **Enmienda (7feb42b):** (vii) encadena tres `decide`: a +200 `scheduled · sen_sinal` + `live` 1-0 → `live` RN-01 sin alerta; barrido a +200 → `finished provisional RN-02` 1-0, `forcedFinish`, una alerta `forced_finish`; a +230 `finished` 2-1 → `finished confirmado RN-12` 2-1 citando esa observación, 0 alertas. Verde sin cambio de motor | verificador: `engine.test.ts` CA-4 (8) verdes; rama en `decide` con `now` inyectado, `resolve: silence` solo desde `live`; idempotencia por tupla evita el parpadeo (iii). Test preexistente «outside live» cambiado de `scheduled` +20 a +14 y añadido `postponed` +20: lo exige la letra nueva, no se debilita · **N-4:** `git diff dce3afb -- src/decide/` solo añade (vii) en `engine.test.ts`; `engine.ts` sin diff. (vii) encadena las tres Decisions de la letra (`live` RN-01 1-0 sin alerta → `finished provisional RN-02` 1-0 `forcedFinish` + 1 `forced_finish` → `finished confirmado RN-12` 2-1 citando el FT, 0 alertas) | ✅ |
| CA-5 | `src/model/entities.ts` (`refine`: `live` o `scheduled`) · `supabase/migrations/20261006200000_spec018_sen_sinal_scheduled.sql` (única migración: `decisions_sen_sinal_check` → `status in ('live','scheduled')`) · 5c382d3 | `src/model/model.test.ts` «SPEC-018 CA-5» (acepta `scheduled`, rechaza `finished`/`postponed`/`suspended`) · `src/ingest/engine.db.test.ts` «SPEC-018 CA-5» (2, rollback: ida y vuelta por el motor + `board`, sin parpadeo, 0 alertas; check `23514` en los otros tres). i18n sin cambios | verificador: `model.test.ts` CA-5 verde; migración `20261006200000` aplicada en local (`pg_get_constraintdef` = `status = ANY('{live,scheduled}')`); `engine.db.test.ts` CA-5 (2) verde; i18n sin diff. Una sola migración | ✅ |
| CA-6 | `src/ingest/informe.ts` (línea `sin directo y sin final: N` + `enLinea` bajo la de SPEC-017 CA-3; `sinSenal.sinDirectoNiFinal`; `prorroga()` reconstruye el tramo +150 → primera Decision no `scheduled` o +360; ese tramo es cobertura a 1 tick / 5 min y no «tras el cierre» ni «fuera de ventana»; la 2.ª línea de cobertura lo dice sin crecer) · `src/ingest/constants.ts` (comentario del techo) · 135eee3 · **Por la enmienda de CA-2 (4f87c4c):** `prorroga()` termina en el primer `finished` sin marca, `postponed` o `suspended` tras +150 (antes: primera Decision no `scheduled`), la misma regla que `isInWindow`; `InformeDecision.forcedFinish` opcional, que `informe-db.ts` rellena con `decisions.forced_finish`. `ventanaEfectiva` sin cambios (la prórroga va aparte) | `src/ingest/informe.test.ts` «SPEC-018 CA-6» (9): (i) 320 `scheduled` → listado; (ii) `finished` → no (va a SPEC-017 CA-3); (iii) `postponed` (y obs. `postponed`/`live`) → no; borde +150 fuera del informe → no; prórroga con final a +200 → esperados 320 + 10 = reales, tras el cierre 0, fuera 0; sin final → 320 + 42; `live` a +150 sin prórroga; línea de cobertura; (iv) veredicto idéntico. Techo medido: 144 (HEAD ae0b30f) → **145** = `INFORME_MAX_LINEAS` · «SPEC-018 CA-6 un live tardío a +200 sigue en prórroga hasta el RN-12 de +230» (esperados = reales = 320 + 16, tras el cierre 0, fuera 0) y «… cerrado forzoso sin FT sigue en prórroga hasta +360» (320 + 42, 100 %). Rojo antes, verde después | verificador: `informe.test.ts` CA-6 (9) verdes; la línea se imprime siempre (una línea, `enLinea`), techo ≤ `INFORME_MAX_LINEAS` = 145 sin cambiar la constante (igual que en origin/main). Denominador de la prórroga = 1 tick / `EXTENSION_POLL_MINUTES` solo donde ninguna ventana normal espera ticks: coherente con SPEC-009 CA-9 (V-1, esperados al ritmo de diseño); ver F-SPEC-018-3 y F-SPEC-018-5 · **N-4 (4f87c4c):** el cambio en `informe.ts`/`informe-db.ts` lo exige la letra: CA-6 dice «los ticks de la prórroga cuentan como cobertura», y la prórroga es la de CA-2 enmendada; sin él, los ticks tras un `live` tardío caerían «tras el cierre». `sacaDeLaProrroga` = misma regla de salida que `isInWindow`; la línea `sin directo y sin final` no cambia; ninguna aserción previa tocada (solo 2 tests añadidos), que fallan contra `src/` de dce3afb (worktree) y pasan en HEAD. Denominador a 1 tick / 5 min **aceptado por el titular el 2026-10-06** | ✅ |
| CA-7 | `src/ingest/reconciliacion-sin-directo.ts` (guarda: alias, vigente `scheduled`, fuera de ventana y prórroga; **una** captura `ids=` para los dos; crudo antes de parsear; todo-o-nada: sin `finished` de los dos no inserta; Observations + `afterInsert` en una transacción) · `tools/reconciliar-sin-directo.mjs` (en seco por defecto, lecturas `read only` + `statement_timeout 30s`) · script `reconciliar:sin-directo` · 1cc2a9c | `src/ingest/reconciliacion-sin-directo.test.ts` (6, `fetch` doble con el cuerpo de H-5 del repo, alias real 2026-27, raw store y BD en memoria) · `src/ingest/reconciliacion-sin-directo.db.test.ts` (1, rollback en local: 1 URL `ids=1572068-1612741`, `decisions` +2, `board` 3-1 y 1-0 `finished provisional RN-01`, `raw_ref` citado, 0 alertas; 2.ª ejecución rehúsa sin pedir). **Ejecución real pendiente del titular** (abajo) | verificador: camino verde con dobles (6) y `.db.test.ts` en local (1 URL `ids=1572068-1612741`, +2 decisions, 3-1 y 1-0 `finished provisional RN-01`, `raw_ref` citado, 0 alertas, 2.ª ejecución rehúsa sin pedir). Ensayo en seco contra `dev` (leído el código: `fetch` doble, store y db dobles, lecturas `read only`): 2026-10-06T19:41:52Z, ambos `scheduled provisional RN-01 v1`, `decisions` 6700, `petición que haría: …ids=1572068-1612741`. Ejecución de campo **pendiente del titular** · **N-4:** `reconciliacion-sin-directo.ts` solo añade `decidedAt: null` a un `scheduled` (entra/sale por tiempo, sin cambio de semántica); sus tests verdes. Segundo ensayo en seco del titular contra `dev` (migración ya aplicada): 2026-10-06T19:49:07Z, ambos `scheduled provisional RN-01 v1`, decisions 6700 / observations 19585 / alerts 32 / ingest_attempts 5622, `…fixtures?ids=1572068-1612741`, nada pedido ni escrito. `--aplicar` **no ejecutado**. ⚠️ aceptada por el titular el 2026-10-06 · **Ejecución única del titular, 2026-10-06T20:28:33.413Z** (tabla de abajo). Comprobado por el verificador con lecturas `read only` + `statement_timeout 30s` contra `dev`: `board` `bergantinos-coruxo` `finished 3-1 provisional RN-01 v2` y `barco-pontevedra-b` `finished 1-0 provisional RN-01 v2`, `forced_finish` false; cada Decision cita una única Observation `finished` (3-1 / 1-0) con `raw_ref` `raw/api-football/2026-10-06/2026-10-06T20-28-33.413Z-SPEC-018-CA-7.json.gz` (2 Observations y 2 Decisions con ese `raw_ref`); conteos 6702 / 19587 / 32 / 5622 (decisions +2, observations +2, alerts +0, ingest_attempts +0). Objeto leído (un GET, sin listar): `200`, 799 B gz, 1 request `fixtures?ids=1572068-1612741` `200`, `1572068 FT 3-1`, `1612741 FT 1-0` = H-5 | ✅ |
| CA-8 | `npm run gates` → exit 0 (typecheck, lint 0 errores / 1 warning previo en `src/arch/deploy.test.ts`, 53 ficheros / 905 tests, build) · `DATABASE_URL=…127.0.0.1:54322… npm run test:db` → 11 ficheros / 92 tests (migración aplicada en local) · `git diff ba655e0..HEAD -- package.json` = solo el script `reconciliar:sin-directo`; 1 migración · **Tras la enmienda:** `npm run gates` → exit 0 (53 / 915, lint 1 warning previo) · `DATABASE_URL=…127.0.0.1:54322… npm run test:db` → `Local database is up to date`, 11 / 96 (el `db:push` va a local: `DATABASE_URL` del entorno gana a `.env`). Sin migración ni dependencia nueva | Medición de peticiones de la primera jornada tras el despliegue: **pendiente** (abajo, «CA-8 medición») | verificador: `npm run gates` exit 0 (53/905, lint 1 warning previo en `deploy.test.ts`, intacto); `DATABASE_URL=…127.0.0.1:54322… npm run test:db` exit 0 (`Local database is up to date`, 11/92); `package.json`: solo un script, 0 dependencias (un script no es dependencia); 1 migración. Medición de la primera jornada **pendiente** · **Re-verificación N-4 (HEAD d02a5c6):** `npm run gates` exit 0 (53 / 915, lint 1 warning previo); `DATABASE_URL=…127.0.0.1:54322… npm run test:db` exit 0 (`Connecting to local database...`, `Local database is up to date`, 11 / 96). La enmienda no añade migración ni dependencia. Medición: residual **aceptado por el titular el 2026-10-06** | ⚠️ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — cierre, 2026-10-06, sdd-verificador.** CA-7 ✅: ejecución única del
titular a las 2026-10-06T20:28:33.413Z, comprobada en `dev` con lecturas
`read only` (board 3-1 y 1-0 `finished provisional RN-01`, ambas Decisions
citan Observations con `raw_ref`
`raw/api-football/2026-10-06/2026-10-06T20-28-33.413Z-SPEC-018-CA-7.json.gz`,
decisions +2, 0 alertas) y el objeto existe en el raw store con la única
petición `ids=1572068-1612741` y `FT` 3-1 / 1-0. CA-1..CA-7 ✅; CA-8 ⚠️ residual
aceptado por el titular (medición de peticiones tras la primera jornada). La
spec pasa a `hecho`.

**GREEN — 2026-10-06, sdd-verificador, tras la enmienda N-4 (HEAD d02a5c6).**
CA-1..CA-6 ✅ contra la letra enmendada; CA-7 ⚠️ (pendiente de la ejecución
única del titular) y CA-8 ⚠️ (medición tras la primera jornada, residual),
ambas aceptadas por el titular el 2026-10-06, igual que el denominador de la
prórroga a 1 tick / 5 min. F-SPEC-018-6 **resuelto**. `engine.ts` y `tick.ts`
sin diff desde dce3afb; tests de SPEC-013 CA-3, SPEC-014 y SPEC-016 sin diff y
verdes. El cambio de CA-6 en el informe lo exige la letra (no es alcance de
más). Los tests nuevos (N-4 de `db.db.test.ts` y los dos de CA-6 en
`informe.test.ts`) fallan contra el `src/` de dce3afb en un worktree aparte
(2 + 2) y pasan en HEAD. La spec sigue en `en-revision` hasta que el titular
lance CA-7 y se rellene su tabla; entonces el verificador cierra.

Evidencia: `npm run gates` → exit 0 (53 / 915); `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` → `Connecting to local database...`, `Local database is up to date`, 11 / 96; `git diff dce3afb --stat -- src/decide/engine.ts src/ingest/tick.ts` → vacío.

**Veredicto anterior — GREEN condicionado — 2026-10-06, sdd-verificador (dce3afb).** CA-1..CA-6 ✅. CA-7 ⚠️
(camino verificado; ejecución única pendiente del titular) y CA-8 ⚠️ (gates
y `test:db` verdes; medición de la primera jornada pendiente). La spec se
queda en `en-revision` hasta que el titular lance CA-7 y se rellene su tabla;
entonces el verificador cierra CA-7 y la pasa a `hecho` (la medición de CA-8
puede quedar como residual aceptado).

Evidencia: `npm run gates` → exit 0 (53 ficheros / 905 tests); `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` → `Local database is up to date`, 11 / 92; `vitest -t SPEC-018` sobre los 7 ficheros → 46 verdes; `npm run reconciliar:sin-directo` (en seco, `dev`) → 0 peticiones, 0 escrituras, URL `fixtures?ids=1572068-1612741`.

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
| 2026-10-06T20:28:33.413Z | Alberto Fojo (titular), `npm run reconciliar:sin-directo -- --aplicar` | 1 (`fixtures?ids=1572068-1612741`) | `raw/api-football/2026-10-06/2026-10-06T20-28-33.413Z-SPEC-018-CA-7.json.gz` | `finished 3-1` y `finished 1-0` `provisional RN-01 v2`; antes 6700 / 19585 / 32 / 5622, después 6702 / 19587 / 32 / 5622 (decisions, observations, alerts, ingest_attempts). Excepción única de N-2: no es regla |

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
- **F-SPEC-018-5** (verificador) — el informe se lee con `hasta` = último kickoff + 150 (SPEC-009 N-1): la prórroga de los partidos de la última franja cae fuera y no entra ni en la cobertura ni en los intentos del informe; la línea `sin directo y sin final` sí los lista. Destino: revisar con la medición de CA-8.
- **F-SPEC-018-6** (verificador, decisión del titular/arquitecto) — ADR-013 §1 dice que la prórroga dura «hasta que la fuente dé `finished`, `postponed` o `suspended`»; CA-2 (iii) saca de ventana un `live` a +200. Si la fuente da `live` dentro de la prórroga (kickoff mal declarado, partido retrasado), por lectura del código (no hay test que lo ejercite) el barrido del mismo tick relee la vigente `live` y RN-02 (≥ +120) la cierra al instante como `finished` forzado con el marcador parcial y alerta `forced_finish`. La implementación cumple la letra de la spec; la discrepancia ADR↔spec la decide el titular. Destino: SPEC-015 / ADR-013 R nuevo. **Resuelto el 2026-10-06** por la enmienda N-4 (12c6572, 8d39191; aprobada por el titular) e implementado en d96b5bb..4f87c4c: un `live` o cierre forzoso decidido en la prórroga sigue en ventana y RN-12 reconcilia; CA-4 (vii) lo ejercita. Queda, aceptado en N-4, que se publica `finished provisional` con el marcador parcial hasta el `FT`.
- **CA-7** ejecutada y cerrada el 2026-10-06 (arriba). La medición de **CA-8** queda como residual aceptado por el titular (2026-10-06): se rellena su tabla tras la primera jornada desplegada.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-6 y el camino de CA-7 con tests; gates y `test:db` en verde en local. Rama `ft/SPEC-018-…`, sin push.
- Enmienda N-4 (F-SPEC-018-6) implementada el 2026-10-06 en d96b5bb, 520b2fe, 7feb42b y 4f87c4c: CA-2 (`isInWindow` con `decidedAt`), CA-3 y CA-4 (vii) solo tests, sin tocar `engine.ts` ni `tick.ts`. El informe (CA-6) sigue la regla nueva para que los ticks tras un `live` tardío cuenten como cobertura. CA-7: `reconciliar:sin-directo` solo pasa `decidedAt: null`; sus tests (6 + 1 db) siguen verdes; no se ejecutó contra `dev`.
- Falta: la ejecución única de CA-7 (titular, procedimiento arriba) y la medición de CA-8 tras la primera jornada desplegada.
- Para seguir: el verificador revisa la enmienda (CA-2 (iii), CA-3, CA-4 (vii), CA-6); tras el PR y el despliegue, el titular lanza CA-7 y se rellenan las dos tablas de arriba.
