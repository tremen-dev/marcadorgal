---
id: SPEC-044
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-044 Recuperación de finales fuera de ventana por la rfef: herramienta de recuperación y horizonte por fuente

## Resumen
- Fase: en-revision (implementación 2026-11-02; CA-8 la ejecuta el orquestador con el titular; CA-9 espera a la jornada 2026-11-06/09)
- Rama: `ft/SPEC-044-recuperacion-de-finales-por-la-rfef` (6 commits sobre `4852eec`, sin push)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | **Bloqueado para este rol** (hook protege-verdad: `docs/fundacion/` es de sdd-arquitecto). Ediciones exactas en F-SPEC-044-1 | `src/arch/reglas-rn08.test.ts` (5 casos; 3 en RED hasta que entren las ediciones); `src/arch/reglas-rn12.test.ts` «leaves the letter of RN-08» admite la nota | | ❌ |
| CA-2 | `src/ingest/constants.ts` (`RECOVERY_HORIZON_HOURS = { rfef: 72 }`, `RECOVERY_POLL_MINUTES = 5`); `src/ingest/window.ts` (`isInRecovery`, `recoveryKickoffRange`) | `src/ingest/constants.test.ts` (claves ∈ `SOURCES`, 72/0/5); `src/ingest/window.test.ts` «SPEC-044 CA-2» (i)-(vi) + rango; los casos de SPEC-013 CA-3 y SPEC-018 CA-2 sin tocar | | ❌ |
| CA-3 | `src/ingest/recuperacion-rfef.ts` (`planRecovery`) | `src/ingest/recuperacion-rfef.test.ts` «CA-3»: 44 obs. de los exports del 10-31 y 11-01 sobre board sintético 39/9/1 → `insert` 44, `groups` 35 (35 instantes ascendentes), live local → `dropped.live`, ventana común → `dropped.inWindow`, repetir con `lastOwn` → 0/0 y 44 duplicadas, 1 cerrado discrepante → 1 `conflict` con `{sourceId, observationId, current, proposed, decisionId}` | | ❌ |
| CA-4 | `src/ingest/engine.ts` (`decideRecovered`, `decideMatches` = cerrojo + `decideLocked`, `createEngineHook` con `{ recovered }`); `src/ingest/tick.ts` (`AfterInsert` con tercer parámetro). `src/decide/` sin diff | `src/ingest/engine.test.ts` «SPEC-044 CA-4» (un `for no key update` con los ids en orden, una lectura por instante, `now` = observedAt, reparto del enganche, sin tercer parámetro igual que antes); `src/ingest/engine.db.test.ts` «SPEC-044 CA-4» (finished provisional RN-01 por rfef con `decided_at` 22:58:41Z y repetición = 0; postponed provisional; dos instantes bajo un cerrojo con espía sobre el SQL) — **no ejecutado aquí** (F-SPEC-044-3) | | ❌ |
| CA-5 | `src/ingest/db.ts` (`recoveryMatches`, `lastRecoveryAttemptAt`, `IngestTx.lastOwnObservations`, `boardBetween`); `src/ingest/memory.ts` (los tres); `src/ingest/tick.ts` (`runTick`/`runAttempt` con recuperables, `details.recuperacion`, `AttemptSummary.recovered`) | `src/ingest/tick.test.ts` «SPEC-044 CA-5» (i) 60 recuperables en 3 fechas → 1 intento rfef con 3 GET y 0 api-football; (ii) enganche con `recovered` y obs. ajena contada; (iii) 2 min → fuera, 5 min → dentro, > 1 h no cuenta; (iv) segundo tick → `insertadas 0, duplicadas 2`; (v) live → `descartadasLive 1`; (vi) barrido solo ventana; fuente sin horizonte no pregunta. `src/ingest/db.db.test.ts` «SPEC-044 CA-5» (las tres consultas) — **no ejecutado aquí** | | ❌ |
| CA-6 | `tools/rfef-recuperar.mjs`; `src/ingest/recuperacion-rfef-db.ts` (`recoveryCandidates`, `recoveryCounts`, `recuperarRfef`); `src/ingest/recuperacion-rfef.ts` (`parseRecoveryArgs`, `recoveryDates`, `planLines`); `src/ingest/engine.ts` (`openAlert` exportado); `package.json` (`rfef:recuperar`) | `src/ingest/recuperacion-rfef.test.ts` «CA-6» (args, ≤ 7 días, fechas, líneas); `src/ingest/recuperacion-rfef-db.test.ts` (orquestación sobre dobles con el adaptador real y los exports: en seco → 2 GET a explorer, crudo, intento `dryRun`, 0 escrituras; aplicado → 5 obs., 4 Decisions a su instante, 1 `conflict`, un cerrojo, una transacción; cadencia ocupada → 18 reintentos y 0 GET; rango vacío; fetch 503); `src/ingest/recuperacion-rfef-cli.test.ts` (cáscara); `src/ingest/recuperacion-rfef.db.test.ts` «CA-6» (contra Postgres, rollback, fixtures) — **no ejecutado aquí** | | ❌ |
| CA-7 | mismo código que CA-6 (`planRecovery` + `decideRecovered` + dedupe de `openAlert`) | `src/ingest/recuperacion-rfef-db.test.ts` «segunda pasada»: 0 obs., 0 Decisions, 0 alertas, +1 intento; `src/ingest/recuperacion-rfef.db.test.ts` «CA-7» (segunda pasada y `lastSeenAt` refrescado → +5 obs., 0 Decisions, gemelas = 0 por SQL) — **no ejecutado aquí** | | ❌ |
| CA-8 | n-a (lo ejecuta el orquestador con el titular; runbook abajo) | evidencia a recoger abajo | | ❌ |
| CA-9 | n-a (jornada 2026-11-06/09) | consulta abajo | | ❌ |
| CA-10 | diff solo en `src/ingest/`, `src/arch/`, `tools/`, `package.json` (script); `src/sources/rfef/` sin tocar; `src/decide/`, `src/model/`, `src/app/`, `src/components/`, `supabase/`, `.github/` sin diff; sin dependencias ni migraciones | `git diff --stat 4852eec -- src/decide src/model src/app src/components supabase .github` vacío; gates en worktree LF (abajo) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-044/. Informe HTML opcional: _qa/SPEC-044/informe.html -->

## Gates (implementador, 2026-11-02)
- Entorno: Windows con `core.autocrlf=true`; los tests que leen docs y `biome` fallan por CRLF en el árbol principal, así que los gates se corren en un worktree LF (`git -c core.autocrlf=false worktree add --detach D:/src/tremen-dev/wt-spec044-lf`, junction de `node_modules`), en el commit `cdca113`.
- Base (HEAD `4852eec`, mismo worktree): 13 fallos preexistentes en 4 ficheros (`calendar/cli`, `db/test-db`, `design/fonts`, `design/no-hex`) y 1 aviso de lint preexistente.
- Resultado: ver «Cómo retomar». `npm run test:db`: **no ejecutado** (Supabase local parado); los cuatro ficheros `*.db.test.ts` nuevos o ampliados compilan (`tsc`) y quedan para el verificador.

## CA-8 — runbook para el orquestador y el titular
Con `.env` local apuntando a producción (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RFEF_EXPLORER_URL`, `RFEF_EXPLORER_TOKEN`), en la rama fusionada:
1. Antes: `npm run informe:jornada` no hace falta; basta la consulta de conteos:
   `select (select count(*) from decisions) decisions, (select count(*) from observations where source_id='rfef') obs_rfef, (select count(*) from alerts where resolved_at is null) alertas_abiertas;`
   y el board del rango:
   `select match_id, status, home_score, away_score, qualifier from board where kickoff >= '2026-10-29T22:00Z' and kickoff < '2026-11-02T23:00Z' order by kickoff, match_id;` (49 filas esperadas: 10 Primera, 11 Segunda, 10 Primera RFEF, 9 Segunda RFEF, 9 Tercera).
2. En seco: `npm run rfef:recuperar -- --desde 2026-10-30 --hasta 2026-11-02 --dry-run | tee docs/epicas/EPIC-FIX/_qa/SPEC-044/dry-run.txt` (salida íntegra al ledger). Imprime una línea por observación del export (partido · vigente → propuesto · acción), el `raw_ref`, los conteos y «En seco». Debe cuadrar con los 39: `insertar` ≈ 44 (16 del 10-31 + 28 del 11-01 si explorer sigue como en los fixtures; más las filas finales del 11-02 que ya tenga), `decidir` = los `scheduled` del export con final, `en ventana` = el partido de Primera del 11-02 si se corre durante su ventana, `cerrados` = los 9 `finished` con `coinciden`/`discrepan`.
3. Aplicar, solo si el plan cuadra: `npm run rfef:recuperar -- --desde 2026-10-30 --hasta 2026-11-02 | tee docs/epicas/EPIC-FIX/_qa/SPEC-044/aplicar.txt`.
4. Después: las dos consultas de (1) y
   `select source_id, started_at, ok, raw_ref, details->'recuperacion' from ingest_attempts where details ? 'recuperacion' order by started_at desc limit 5;`
   `select kind, match_id, details from alerts where kind='conflict' and resolved_at is null order by opened_at desc;`
   gemelas e invertidos: `npm run informe:jornada -- 2026-10-30T18:00Z 2026-11-02T23:00Z` (línea «Decisiones gemelas: 0 · `decided_at` invertido: N» — los invertidos son los de la recuperación, esperados).
   `/api/board` muestra los finales.
- Esperado: de los 39 `scheduled`, 35 → `finished provisional` (RN-01, `rfef`) y Tenerife–Andorra → `postponed provisional`; los 3 de Segunda del lunes 11-02 (`oviedo-las-palmas`, y los otros dos `SCHEDULED` del export del 11-02) y el de Primera del 11-02 faltan con motivo (sin fila `FINISHED` en el export, o en ventana ese día): si se ejecuta después de sus ventanas con el export ya cerrado, entran también. De los 9 `finished`: los sin marca no cambian y abren `conflict` solo si el marcador discrepa (listados en el plan como `cerrado, discrepa`); los con marca entran en `decidir` y solo cambian por `RN-12`. `observations (rfef)` sube exactamente en `insertadas`; `decisions` sube en `decididas`; una fila de `ingest_attempts` por ejecución con `details.recuperacion.herramienta = "rfef:recuperar"` y objeto `raw/rfef/2026-11-02/…`; gemelas 0.
- Ojo: si la rama se despliega antes de ejecutar la herramienta, el propio tick (CA-5) recupera cada 5 min lo que esté a < 72 h del kickoff (el 10-31 y el 11-01 enteros el lunes; el 10-30 hasta las 20:00Z del lunes). Entonces el `--dry-run` mostrará `duplicada` en lo ya recuperado y la aplicación insertará solo lo que falte (CA-7): es el comportamiento esperado, no un fallo. Los intentos del tick con recuperación se ven con `details ? 'recuperacion'` y `details->'recuperacion'->>'herramienta' is null`.
- Si la cadencia está ocupada 90 s («La cadencia de la rfef no dejó hueco»), reintentar: sale 1 sin haber pedido nada.

## CA-9 — consulta para la jornada 2026-11-06/09
`select date_trunc('hour', started_at) h, count(*) intentos, max((details->>'requests')::int) max_get, sum((details->'recuperacion'->>'insertadas')::int) insertadas from ingest_attempts where source_id='rfef' and details ? 'recuperacion' and started_at between '2026-11-06' and '2026-11-10' group by 1 order by 1;` (≤ 12 por hora; `max_get` ≤ fechas distintas de los recuperables); `select count(*) from ingest_attempts where source_id='api-football' and details ? 'recuperacion';` (= 0); partidos entrados por recuperación: Decisions con `decided_at < recorded_at - interval '10 minutes'` y `home_source_id = 'rfef'` en el rango.

## Salvedades / follow-ups
<!-- IDs F-SPEC-044-1, F-SPEC-044-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-044-1 (bloqueante de CA-1, para sdd-arquitecto/orquestador).** El hook protege-verdad impide a este rol escribir en `docs/fundacion/`. Ediciones exactas que CA-1 y su test esperan:
  - `docs/fundacion/dominio.md`, fila **Ventana**: tras «…se prorroga hasta kickoff + 6 h, con sondeo cada 5 min.» añadir « Una fuente con horizonte de recuperación sigue consultando, cada 5 min y solo para estados finales, los partidos que su Decision no cierra hasta kickoff + horizonte (72 h la rfef).»; en la columna de notas, tras «ADR-013 §1.» añadir « Horizonte por fuente y recuperación manual: ADR-025.».
  - `docs/fundacion/reglas.md`, bajo la viñeta de **RN-08** (tras «dato del registro, no una constante del adaptador.»), una línea indentada con dos espacios: `*Precisada el 2026-11-02 por ADR-025: la ventana de una fuente es la común más su horizonte de recuperación; la recuperación manual contra un servicio propio deja intento y crudo.*` (la letra no cambia).
  - Con eso, `src/arch/reglas-rn08.test.ts` pasa a verde (5/5) y `reglas-rn12.test.ts` ya la admite.
- **F-SPEC-044-2 (nota de diseño).** CA-5 nombra dos métodos nuevos de `IngestDb`; hizo falta un tercero, en `IngestTx`: `lastOwnObservations(sourceId, matchIds)`, leído dentro de la transacción que inserta, para la identidad de ADR-025 §5. Los cuatro dobles `engineTx` de los tests existentes ganan la propiedad.
- **F-SPEC-044-3 (verificador).** `npm run test:db` no se ejecutó (Supabase local parado): `engine.db.test.ts` «SPEC-044 CA-4», `db.db.test.ts` «SPEC-044 CA-5», `recuperacion-rfef.db.test.ts` (CA-6, CA-7). Compilan con `tsc`; `recuperacion-rfef-db.test.ts` cubre la misma orquestación sobre dobles con un `sql` que responde por sentencia (y se comprobó por mutación que el guard de `--dry-run` hace fallar el test).
- **F-SPEC-044-4 (EPIC-MANT, ya previsto en H-5).** `RECOVERY_HORIZON_HOURS` en `constants.ts`; su sitio es `SourceConfig`.
- **F-SPEC-044-5 (menor).** `decideMatches` se partió en cerrojo + `decideLocked` para que `decideRecovered` tome un solo cerrojo; el test de SPEC-035 CA-1 («the second engine waits») sigue cubriendo el camino del tick sin cambios.
- **F-SPEC-044-6 (CA-6, decisión de implementación).** Los partidos del rango salen de `board` (el calendario cargado), no del fichero JSON: así traen vigente, `decision_id` y temporada en una consulta; un partido declarado en el fichero pero no cargado no entra (en producción no pasa: `calendario:load` los carga). Las observaciones del export de partidos fuera del rango se cuentan en `details.fueraDeVentana` del intento de la herramienta.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (commits `f7d7476` CA-1 test + CA-2, `1e1103f` CA-3, `e366ff0` CA-4, `78a5d47` CA-5, `cdca113` CA-6/CA-7): código y tests de CA-2..CA-7 en verde en CI unitario; los `*.db.test.ts` escritos y compilando.
- Falta: (a) las dos ediciones de `docs/fundacion/` (F-SPEC-044-1) por quien pueda escribirlas; (b) `npm run test:db` con Supabase local (F-SPEC-044-3); (c) CA-8 con el titular (runbook arriba) y su evidencia en `docs/epicas/EPIC-FIX/_qa/SPEC-044/`; (d) CA-9 tras la jornada 2026-11-06/09.
- Gates del implementador (worktree LF, commit `cdca113`): se anotan en el informe final del implementador; el worktree `D:/src/tremen-dev/wt-spec044-lf` se borra al terminar.
