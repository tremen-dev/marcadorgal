---
id: SPEC-046
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-11-03, por: sdd-arquitecto}
---
# SPEC-046 — La rfef sin directo probado no cierra un marcador, y herramienta de operador

## Problema
**Daño (2026-11-02).** `primera-division-2026-27-j11-deportivo-osasuna` (kickoff 20:00Z, real 2-1) se publicó **`finished` 0-0** (v1 `live` RN-01 20:03Z; v2 RN-02 cierre forzoso 22:00:06Z). API-Football: 0/359 intentos ok (plan gratuito, y así seguirá: la rfef será a menudo la única fuente). rfef: 215 `live` 0-0 sin un cambio; el 0-0 es el valor de arranque del panel de la RFEF, que no llevaba el directo; explorer descartó 16 lecturas `SCHEDULED` de la página de jornada y aun así refrescó `lastSeenAt`, que es nuestro `observedAt`. Corregido a mano por SQL con autorización del titular (observación `operator` 2-1 con `raw_ref` sin objeto en Storage, Decision v3 `operator`, alerta resuelta): no hay herramienta. **Plazo:** antes de la jornada del 2026-11-07/08. Ejecuta **ADR-026**.

## Usuarios / roles afectados
- Público: deja de ver como final un marcador que nadie movió. Titular/operador: corrige un resultado con un comando y deja crudo.
- explorer (fuera de tremen-sdd): requisito externo de CA-6, lo trabaja el titular.

## Criterios de aceptación
- **CA-1 La verdad dice lo que ADR-026 fija.** `dominio.md` **Cualificador** con la letra de ADR-026 §5; `reglas.md` **RN-02** con la nota fechada, letra intacta; ADR-023 con nota fechada «§4-§5 precisados por ADR-026». Test `src/arch/reglas-rn02.test.ts` (como `reglas-rn08.test.ts`).
- **CA-2 Cobertura en directo (adaptador, puro).** `RFEF_LIVE_COMPETITIONS` en `src/sources/rfef/explorer.ts`; `SkippedReason` gana `no_live_coverage` y `contradicted_live`. Tests `explorer.test.ts` con un fixture nuevo del export del 2026-11-02 sacado del crudo de producción (acta 70694627): `LIVE_PROVISIONAL` de `primera-division` → `skipped: no_live_coverage`; la misma fila en `primera-rfef-g1` → `live`; `FINISHED` de `primera-division` → `finished`. Los tests de SPEC-038 siguen verdes; los recuentos que cambien por esto, listados en el ledger.
- **CA-3 Live contradicho.** Dado `LIVE_PROVISIONAL` 0-0 con `discardedReadings: 16` en competición cubierta → `skipped: contradicted_live`; con `discardedReadings: 0` → `live`; 1-0 con descartes → `live`. Los `skipped` llegan a `ingest_attempts.details` contados por motivo (caso en `tick.test.ts`).
- **CA-4 Cierre forzoso sin respaldo (motor puro).** `UNBACKED_CLOSE_PRIORITY = 10` en `src/decide/thresholds.ts`. Tests `src/decide/engine.test.ts`: (i) solo rfef (5), `live` 0-0 sin cambios, kickoff + 120 → `finished` 0-0, RN-02, `sen_sinal`, `forcedFinish: true`, alerta `forced_finish` con `unbacked: true`; (ii) igual con api-football (10) → `provisional`, sin `unbacked`; (iii) rfef 0-0 → 1-0 → `provisional`; (iv) rfef y api-football → `provisional`; (v) tras (i), rfef `finished` 2-1 → RN-12 `confirmado`. Replay de los fixtures de jornada existentes: 0 Decisions distintas salvo casos del tipo (i), listados.
- **CA-5 Esquema y pantalla.** Migración: `decisions_sen_sinal_check` admite `sen_sinal` en `finished` solo con `forced_finish = true` (test db: `finished · sen_sinal` sin marca → rechazo). `MatchRow` pinta `finished · sen_sinal` con etiqueta de texto y marcador atenuado, nunca solo con color (test de componente + captura gl/es en `_qa/SPEC-046/`).
- **CA-6 Frescura (externo).** explorer: una lectura descartada no avanza `last_seen_at` (ADR-026 §4). Evidencia en el ledger: commit y test de explorer, y un export de producción posterior con una fila con `READING_DISCARDED` cuyo `lastSeenAt` es el de la última lectura aceptada. marcadorgal no cambia código por este CA.
- **CA-7 Herramienta de operador.** `npm run operador:resultado -- --partido <matchId> --estado finished|postponed|suspended [--marcador H-A] --motivo "<texto>" [--evidencia "<url|texto>"] [--resolver-alertas] [--dry-run]` (cáscara `tools/operador-resultado.mjs`; lógica pura en `src/ingest/operador.ts`, consultas en `operador-db.ts`). El partido existe en el calendario declarado; `finished`/`suspended` exigen marcador. Orden: (1) crudo JSON `{herramienta, autor, creadoEn, matchId, estado, marcador, motivo, evidencia}` a `RawStore` con clave ADR-007 bajo `operator/<día>/` **antes** de insertar (RN-09); (2) una transacción: `lockMatches`, observación `source_id 'operator'` con `observedAt` = instante del comando y `raw_ref = raw/<clave>`, motor (`decideMatches`) → Decision `operator · confirmado` (la escribe el motor, D-5); con `--resolver-alertas`, cierra las alertas abiertas del partido con `details.resolucion {herramienta, observationId, decisionId}`; (3) imprime antes/después. `--dry-run`: ni crudo ni filas. Tests db (rollback, `RawStore` en memoria): vigente `finished · RN-02` 0-0 → versión nueva `operator` 2-1 y alerta resuelta; repetir igual → observación nueva y 0 Decisions (ADR-009 §2); fallo de `put` → 0 filas.
- **CA-8 Regularizar la corrección del 2026-11-03.** La herramienta, en modo `--solo-crudo --raw-ref <ref>`, sube a la clave ya referenciada el registro de esa corrección (autor, motivo, evidencia que aporte el titular) sin tocar filas. Evidencia: `get` del objeto devuelve el JSON; recuentos de `observations`, `decisions` y `alerts` del partido iguales antes y después.
- **CA-9 Fronteras y gates.** Diff solo en `src/sources/rfef/`, `src/model/` (solo `SkippedReason`), `src/decide/` (cierre forzoso y umbral), `src/ingest/`, `src/components/xornada/` (si CA-5 lo pide), `supabase/migrations/`, `tools/`, `package.json`, `docs/fundacion/`, ADR-023 (nota) y tests. `npm run gates` → 0; `npm run test:db` en verde.

## Entidades y reglas afectadas
Observation, Decision, Alert, Cualificador, Frescura, Operador (`dominio.md`); RN-01, RN-02 (nota), RN-05, RN-07, RN-09, RN-11, RN-12; D-5, D-6, D-9; **ADR-026**, ADR-007, ADR-009 §4, ADR-010 §1-§2, ADR-013, ADR-019, ADR-023 §4-§5, ADR-025.

## Fuera de alcance
- El cambio dentro de explorer (CA-6 solo recoge su evidencia). Pagar API-Football.
- Panel web de operador, corrección de un `live` en curso, roles o autenticación del operador (EPIC-004).
- Que SPEC-039 cuente el «marcador congelado» (un 0-0 bajo el acta no es «dígito falso» en su CA-2): se le anota, no se toca aquí.

## Notas para el gate humano
- **Relación.** **SPEC-039** (en curso, jornada 2026-11-07/08): si esta spec entra antes, la rfef no da `live` en Primera/Segunda y su cobertura (CA-1 (c)) ahí es 0 por diseño; los `no_live_coverage` contados y los exports siguen midiendo si la RFEF mueve esos marcadores, que es lo que reabre H-1. **SPEC-044**: es la vía por la que llega el final real (acta) a un partido que §1 deja `scheduled · sen_sinal` o que §3 cierra `sen_sinal` (RN-12).
- **H-1 Cobertura inicial.** Sin directo de la rfef en `primera-division` y `segunda-division`; con directo en las tres RFEF. Evidencia: un partido. ¿Basta, o se apagan solo cuando SPEC-039 lo confirme?
- **H-2 Umbral 10.** «Una sola fuente < 10» deja fuera a API-Football sola (su 0-0 congelado sigue `provisional`). ¿O < 50 (cualquier proveedor solo)?
- **H-3 `finished · sen_sinal`** frente a `provisional` + alerta `unbacked` (no cambia esquema ni pantalla, pero publica el 0-0 como final). Recomendado: `sen_sinal`.
- **H-4 Live contradicho** usa `discardedReadings` acumulado (ADR-026, follow-ups). ¿Aceptado hasta tener un campo mejor en el export?
- **H-5 Plazo y orden.** Recomendado: implementar antes del 2026-11-07 en rama propia, sin tocar la de SPEC-039; CA-6 cuando el titular lo tenga en explorer, sin bloquear el resto.
- **H-6 CA-8.** ¿Qué texto y evidencia van en el crudo de la corrección del 2026-11-03? El `raw_ref` usado (`operator/2026-11-03/…`) no lleva el prefijo `raw/` de ADR-007: ¿se sube a esa clave tal cual y se anota en el ledger?
