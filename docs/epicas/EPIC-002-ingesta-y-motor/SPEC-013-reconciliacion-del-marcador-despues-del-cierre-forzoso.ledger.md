---
id: SPEC-013
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-013 Reconciliación del marcador después del cierre forzoso

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-013-reconciliacion-del-marcador-despues-del-cierre-forzoso`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/reglas.md` RN-12 (74c11b2, fuera del implementador: F-SPEC-013-1) | `src/arch/reglas-rn12.test.ts` (5): RN-12 = cita de ADR-010 §2, en la sección de `Decision.rule`, `DecisionRule` ⊆ esa sección, RN-08 literal; rojo 2/5 en bb36c05, verde tras 74c11b2 | | |
| CA-2 | `supabase/migrations/20260929081827_rn12_decision_rule.sql` · `src/model/vocab.ts` · 0078427 | `src/ingest/engine.db.test.ts` › «SPEC-013 CA-2» (inserta RN-12; RN-99 → 23514) · `src/model/model.test.ts` › DecisionRule; rojo antes de la migración | | |
| CA-3 | `src/ingest/window.ts` (`rule` en `WindowInput`) · `src/ingest/db.ts` (`windowMatches` lee `decisions.rule` por `board.decision_id`) · ada3052 | `src/ingest/window.test.ts` › «SPEC-013 CA-3» (i)–(iv); `src/ingest/db.db.test.ts` › «at +125, a finished by …» (RN-02 dentro; RN-01, RN-12 fuera), rojo sin el cambio | | |
| CA-4 | `src/decide/engine.ts` (bloque RN-12 antes de RN-05) · 15bfda2 | `src/decide/engine.test.ts` › «SPEC-013 CA-4» (i)–(v) + mismo marcador; rojo 4/6 antes · `src/ingest/engine.db.test.ts` › «SPEC-013 CA-4 RN-12 through the database» | | |
| CA-5 | Lectura preparada abajo («CA-5: lectura para el 2026-10-05») | Pendiente de campo (H-2), jornada 2026-10-02/04 | | |
| CA-6 | `src/ingest/reconciliacion.ts` · `tools/reconciliar-cierre.mjs` · script `reconciliar:cierre` · 568b2d0, 0a8df89 | `src/ingest/reconciliacion.test.ts` (6) · `src/ingest/reconciliacion.db.test.ts` (1, rollback, +1 Decision RN-12) · ejecución real **incompleta**: F-SPEC-013-2 | | |
| CA-7 | Una migración; `package.json` solo `reconciliar:cierre`; lock sin cambios | `npm run gates` exit 0 (50 ficheros, 745 tests), también sin env; `npm run test:db` exit 0 (10, 79). Presupuesto de la jornada: pendiente de campo con CA-5 | | |

## Evidencia CA-6 (2026-09-29, ejecución única autorizada en H-1)

- Ensayo en seco (`npm run reconciliar:cierre`, sin red ni escritura): pediría `fixtures?ids=1569939` y `fixtures?ids=1570756`, una captura por partido.
- `replay:jornada` en seco con el motor nuevo: `39 partidos, 0 divergen, 0 con corrección.`
- `npm run reconciliar:cierre -- --aplicar`, **una vez**, `now` 2026-09-29T08:27:59.958Z. Dos peticiones `ids=` (200), crudo guardado antes de parsear:
  - ceuta-real-sociedad-b · fixture 1569939 · proveedor **FT 3-1** · `raw/api-football/2026-09-29/2026-09-29T08-28-00.700Z-SPEC-013-CA-6-1569939.json.gz` (4 629 B gz, sha256 `d250f9b0ee440af6…`) · observation `c29ab562-02d8-47a6-a40b-1cf1c82fffe3`
  - merida-logrones · fixture 1570756 · proveedor **FT 3-5** · `raw/api-football/2026-09-29/2026-09-29T08-28-01.934Z-SPEC-013-CA-6-1570756.json.gz` (1 384 B gz, sha256 `060ac1c74405142a…`) · observation `98945fc9-052a-4308-9836-c7964cd1c67f`
  - Releídas del bucket: 0 apariciones de `API_FOOTBALL_KEY`.
- Conteos antes → después: `decisions` 3356 → **3356 (+0, esperado +2)** · `observations` 9341 → 9343 · `alerts` 17/17 abiertas → 17/17 · `ingest_attempts` 2766 → 2766.
- `board` después: ceuta **2-1** RN-02 v107, merida **3-4** RN-02 v107: **sin corregir**. Contraste: sigue **37 de 39**. Causa y opciones en F-SPEC-013-2.

## CA-5: lectura para el 2026-10-05 (una consulta, solo lectura)

```sql
with ff as (select match_id, opened_at from alerts
  where kind = 'forced_finish' and opened_at >= :desde and opened_at < :hasta),
rec as (select ff.match_id, ff.opened_at, min(d.decided_at) as rn12_at
  from ff left join decisions d on d.match_id = ff.match_id and d.rule = 'RN-12'
    and d.decided_at <= ff.opened_at + interval '30 minutes'
  group by ff.match_id, ff.opened_at)
select count(*) as cierres_forzosos, count(rn12_at) as con_rn12_en_30min,
  percentile_cont(0.5) within group (order by extract(epoch from rn12_at - opened_at)) as mediana_s,
  max(extract(epoch from rn12_at - opened_at)) as max_s
from rec;
```

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-013/. Informe HTML opcional: _qa/SPEC-013/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-013-1, F-SPEC-013-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-013-1 — CA-1 bloqueado al implementador por protege-verdad — CERRADO en 74c11b2.** El texto que aplicó el titular coincide con la cita de ADR-010 §2 y con la nota `*Añadida el 2026-09-29 por ADR-010 §2.*`; `reglas-rn12.test.ts` 5/5.
- **F-SPEC-013-2 — CA-6 incompleto: las observaciones entraron y el motor no publicó (destino: gate humano). BLOQUEANTE.** El script tomó `now` al empezar y la captura se selló después (`observed_at` 08:28:00.700Z y 08:28:01.934Z > `now` 08:27:59.958Z). El motor solo ve lo que ya ocurrió (`age >= 0`), así que no hubo winner y no se publicó RN-12. Corregido en 0a8df89 (la captura usa el mismo `now`, como el tick; y `reconciliarCierres` se detiene sin insertar si la captura es posterior a `now`), con test que reproduce el fallo. **No se ha vuelto a ejecutar nada.** Salidas posibles, las dos necesitan autorización escrita porque H-1 autorizó UNA ejecución: (a) sin petición nueva: correr solo el motor (`decideMatches`) sobre los dos partidos con `now` = `observed_at` de cada observación ya guardada: publica RN-12 3-1 y 3-5 citando esas observaciones y el `raw_ref` de arriba (`decided_at` sería el de la captura); (b) volver a correr `reconciliar:cierre -- --aplicar` ya corregido: 2 peticiones más y 2 observaciones más. La guarda (vigente `finished` RN-02) **no** impide hoy esa segunda ejecución, porque la vigente sigue siendo RN-02.
- **F-SPEC-013-3 — Lectura de «`finished` confirmado» en CA-4 (iv) (destino: sdd-arquitecto).** En el motor, «confirmado» es el **cualificador**: un `finished confirmado` (RN-12, o RN-01 confirmado) no admite nada salvo el operador. Un `finished` RN-01 `provisional` sigue aceptando otro `finished` por RN-01, como hoy (se conserva el test de SPEC-007 «does publish a finished with a higher score (RN-01)»). En producción es inalcanzable: ese `finished` saca al partido de la ventana (CA-3). En la ventana, «confirmado» es «no RN-02».
- **F-SPEC-013-4 — Cobertura del informe de SPEC-009 con la prórroga (destino: quien lea CA-5/CA-7 el 2026-10-05).** `ventanaEfectiva` (`src/ingest/informe.ts`) cierra en el `decided_at` del `finished` vigente: los ticks de +120 a +150 de un cierre forzoso saldrán como «tras el cierre», no como cobertura. El criterio 2 (ventana declarada) no cambia. No se toca: regenerar o cambiar el informe está fuera de alcance.
- **F-SPEC-013-5 — Las correcciones de SPEC-012 son RN-02.** `replay:jornada --aplicar` escribe `finished` RN-02: con CA-3, un partido así dentro de +150 volvería a estar en ventana. Hoy da igual (ventanas vencidas).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 (titular, 74c11b2), CA-2, CA-3, CA-4, código y tests de CA-6. `npm run gates` exit 0 (también sin env), `npm run test:db` exit 0.
- **Bloqueado**: CA-6 en `dev` (F-SPEC-013-2): hay 2 observaciones nuevas y 0 Decisions; `board` sigue 2-1 / 3-4. Espera decisión humana (a) o (b). **No re-ejecutar `reconciliar:cierre -- --aplicar` sin ella.**
- Pendiente de campo: CA-5 y el presupuesto de CA-7 (jornada 2026-10-02/04; lectura arriba).
- Spec en `en-progreso`: no pasa a `en-revision` hasta cerrar F-SPEC-013-2.
