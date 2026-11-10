---
id: SPEC-071
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-071 Sync histórico con ventana y kickoffs reales en el calendario

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-071-sync-historico-con-ventana-y-kickoffs-reales` (la que abrió el orquestador)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/explorer-window.ts` (`pickRowInWindow`, ventana ±3 días Madrid); `src/ingest/historico.ts` (`planDaySync` acepta filas por día, `rowDate`); fixture `src/sources/rfef/fixtures/export/export-2026-10-31-celta-fortuna-cordoba.json` (+ `.headers`, README) | `src/ingest/historico.test.ts` › «CA-1 the match declared on 11-01 pairs with acta 70695028 of 10-31: 2-2 and its goals»; `src/lib/explorer-window.test.ts` | Revisado: fixture crudo + test exige 70695028, `rowDate` 10-31, 2-2 y los 4 goles; `vitest` verde | ✅ |
| CA-2 | `src/lib/explorer-window.ts` (preferencia por la única `FINISHED`, luego día **y** hora) | `historico.test.ts` › «CA-2 a POSTPONED and a FINISHED…», «CA-2 two FINISHED: ambiguous, no plan», «CA-2 only the POSTPONED…»; `explorer-window.test.ts` › «several candidates, exactly one FINISHED», «two FINISHED off the kickoff day and hour», «the tie-break needs the kickoff day and its hour» | Revisado: `pickRowInWindow` (una → esa; única FINISHED; desempate día **y** hora; si no `ambiguous`); tests de 2 FINISHED → ambiguo sin plan y solo POSTPONED → sin `finalScore`; verde | ✅ |
| CA-3 | `src/lib/explorer-window.ts` (`rowsInWindow`); `src/ingest/historico.ts` (motivo sobre toda la ventana) | `historico.test.ts` › «CA-3 a row with another team on a neighbour day…», «CA-3 the right row at day +4 or −4…»; `explorer-window.test.ts` › «days outside ±3 are never read» | Revisado: `isSameMatch` sin cambios; rival distinto en día vecino → `no_identity`; ±4 → `no_competition_rows`; motivo sobre `rowsInWindow`; verde | ✅ |
| CA-4 | `src/ingest/historico.ts` (`pairedLine` con `fecha → fecha de la fila`); `src/ingest/historico-db.ts` (`matchesOtherDay`, caché por día); `tools/historico-sync.mjs` (línea «Noutro día (±3)») | `historico.test.ts` › «CA-4 the line says the day of the row, the report counts matchesOtherDay, and each day is asked once» (fetcher que cuenta: 8 días, cada uno una vez) | Revisado: línea `fecha → fecha de la fila`, `matchesOtherDay`, caché por día (fetcher cuenta 8 días, uno cada uno); verde | ✅ |
| CA-5 | `src/calendar/real-kickoffs.ts` (`realKickoffs`, `realKickoffDays`); `src/lib/explorer-window.ts` (`madridKickoff`) | `src/calendar/real-kickoffs.test.ts` (8 casos: Celta Fortuna–Córdoba → `2026-10-31T17:30:00Z`, Céltiga–Somozas → `2026-10-24T15:00:00Z`, 17:33 tal cual, sin cambio ×7, ambiguo listado, POSTPONED+FINISHED, `since`, días); `explorer-window.test.ts` › `madridKickoff` | Revisado + sonda propia de `madridKickoff` a ambos lados del 25-oct y 29-mar (ida y vuelta Europe/Madrid exacta, `Z` sin ms); solo FINISHED corrige; kickoff ≥ now excluido; verde | ✅ |
| CA-6 | `src/calendar/sync.ts` (`SyncInput.realKickoffs` → `diff.rescheduled`); `tools/calendario-sync.mjs` (`[now − 8 d, now)` y `--reales-desde`, todas las competiciones, cada día del export una vez); `src/calendar/cli.fake-provider.mjs` (`FAKE_EXPORT_MATCHES`) | `src/calendar/sync.test.ts` › «SPEC-071 CA-6 …» (línea `~ … PASADO`, `autoAplicable`, un segundo sync no revierte, sin cambio); `src/calendar/cli.test.ts` › «SPEC-071 calendario:sync corrects the real kickoffs» (Segunda y Tercera con `--reales-desde`, sin flag solo 8 días, POSTPONED no corrige, flag inválido → 1; todo `--dry-run`) | Revisado: correcciones tras el bucle del importador → `diff.rescheduled` (PASADO); 2.º sync no revierte (test + `isPast`); cli `--dry-run` con Segunda/Tercera, 8 d, POSTPONED, flag inválido; verde | ✅ |
| CA-7 | `_qa/SPEC-071/` (logs de los dos dry-runs, `ca9-check.mjs` adaptado, `ca9-check.log`, `otras-correcciones.txt`, `baseline-calendario-sync-sin-spec071.log`) | evidencia abajo | Revisada la evidencia: (a) 552/1/0/19, Rayo–Athletic único sin emparejar, 19/19 vecinos con su fecha, `rival_distinto=0`, Celta línea correcta; (b) 17 FINISHED con instante correcto (recalculado de `ca9-vecinos.log`), ninguna para los 2 POSTPONED ni Rayo, 55 = diff exacto contra baseline (56−1 líneas `+` ajenas), 38 listadas; exit 1 preexistente en baseline (F-SPEC-071-1) | ✅ |
| CA-8 | ajustes de test justificados abajo | `vitest run` en worktree LF; `next build` en el árbol principal | Worktree LF `6a5e1e2`: `tsc` 0 · `biome` 0 (437) · `vitest` 1 failed / 2550 passed / 3 skipped, único fallo F-SPEC-070-4 ajeno; `npm run build` exit 0; ajustes de fetchers revisados: mismas aserciones, solo acotan el día | ✅ |

### Evidencia del implementador (2026-11-10)

**CA-7 (a)**, solo lectura (SELECT a prod, GETs a explorer):
`RFEF_EXPLORER_TOKEN=… npm run historico:sync -- --dry-run --desde 2026-08-14 --hasta 2026-11-09` → exit 0, `_qa/SPEC-071/dry-run-historico-2026-08-14_2026-11-09.log`:

    Partidos analizados: 553 · emparejados: 552 · Sen emparejar: 1 · Ambiguos: 0 · Noutro día (±3): 19
    Sen emparejar: 2026-10-10 · primera-division-2026-27-j8-rayo-vallecano-athletic-club · no_identity   (F-SPEC-070-2)
    2026-11-01 → 2026-10-31 · segunda-division-2026-27-j12-celta-fortuna-cordoba · 70695028 · RC Celta Fortuna–Córdoba CF · 2-2 · 4 goles

`node docs/epicas/EPIC-FIX/_qa/SPEC-071/ca9-check.mjs <log>` → `emparejados=552 rival_distinto=0 ambos_lados_por_alias=552 algun_lado_por_id_canonico=0 sin_calendario=0 noutro_dia=19` · `vecinos_ca9_emparejados=19/19` (cada uno con la fecha de fila de `_qa/SPEC-070/ca9-vecinos.log`; los 2 `POSTPONED` emparejan sin marcador).

**CA-7 (b)**, `--dry-run`, nada escrito (`git status` sin cambios en `data/`):
`RFEF_EXPLORER_TOKEN=… npm run calendario:sync -- 2026-27 --dry-run --reales-desde 2026-08-14` → `_qa/SPEC-071/dry-run-calendario-reales-desde-2026-08-14.log`. 55 líneas `~ … PASADO`, 0 ambiguos, 0 días del export fallidos. Las **17** `FINISHED` de `ca9-vecinos.log`, todas con su instante (p. ej. `celta-fortuna-cordoba: 2026-11-01T16:00:00Z -> 2026-10-31T17:30:00Z`, `celtiga-somozas: … -> 2026-10-24T15:00:00Z`, `atletico-arteixo-lalin: … -> 2026-11-07T16:33:00Z`, `estradense-celta-c: … -> 2026-11-07T15:47:00Z`). Ninguna para Castellón–Eibar, Granada–Tenerife ni Rayo–Athletic. **Otras 38** en `_qa/SPEC-071/otras-correcciones.txt`, todas el mismo día del kickoff declarado: 19 horas reales de jornadas con hora de relleno (Segunda J12 Burgos–Castellón, Ceuta–Sporting, Eldense–Granada; Tercera J8–J10) y 19 desfases de 1 a 23 min (`horaTexto` no redondo: Primera ×3, Segunda ×2, Primera RFEF ×3, Segunda RFEF ×3, Tercera J2–J7 ×8).
Exit 1 y `auto-aplicable: no` **preexistentes**: el mismo comando sin SPEC-071 (código de `23748dd`, `baseline-calendario-sync-sin-spec071.log`) da exit 1 por `segunda-rfef-g1.json: 90 problema(s)` y 3 `renamedAtProvider` (F-SPEC-071-1).

**CA-8**: `npx vitest run` de `explorer-emparejamiento`, `historico`, `explorer-xornada`, `explorer-enrichment`, `sync`, `cli` y los dos nuevos → `Test Files 8 passed · Tests 122 passed`. Worktree LF en `a63f0ce`: `tsc --noEmit` 0 · `biome check .` 0 (437 ficheros) · `vitest run` → `1 failed | 2550 passed | 3 skipped`; el único fallo es `src/db/test-db.test.ts` «wins over a .env file in the cwd too» (F-SPEC-070-4, también en main en Windows). `npm run build` en el árbol principal → exit 0.
Ajustes justificados: los fetchers falsos de `historico.test.ts` (SPEC-070 CA-7) y `historico.db.test.ts` (SPEC-060) devolvían el mismo cuerpo para cualquier fecha; con la ventana se piden 7 días y la misma fila salía 7 veces (ambiguo). Ahora responden solo a su día y vacío al resto. `cli.fake-provider.mjs` atiende `/api/export/matches` (vacío por defecto) porque el bot ahora lo pide.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-10 (sdd-verificador).** CA-1..CA-8 ✅. Gates propios en worktree LF (`6a5e1e2`): typecheck 0, lint 0, `vitest` 2550 passed con el único fallo ajeno conocido (`src/db/test-db.test.ts` «wins over a .env file in the cwd too», F-SPEC-070-4); `next build` 0 en el árbol principal. Sin reejecutar contra prod: evidencia de CA-7 contrastada con `_qa/SPEC-070/ca9-vecinos.log` y con el baseline.
Observaciones no bloqueantes:
- O-1: `realKickoffs` no exige `to < now` (src/calendar/real-kickoffs.ts:94); la spec solo exige kickoff declarado `< now`, y una fila `FINISHED` implica pasado. Si explorer diese un `horaTexto` erróneo futuro, el diff lo marcaría como reprogramación.
- O-2: `--reales-desde` valida solo el patrón (tools/calendario-sync.mjs): `2026-13-01` pasa como 2027-01-01; inocuo porque `since` se queda en `now − 8 d`.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-071/. Informe HTML opcional: _qa/SPEC-071/informe.html -->
n-a: sin UI. Evidencia en logs de `_qa/SPEC-071/` (dry-runs, `ca9-check.log`, baseline).

## Salvedades / follow-ups
<!-- IDs F-SPEC-071-1, F-SPEC-071-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-071-1** (EPIC-FIX, urgente): `calendario:sync` falla hoy en main sin SPEC-071 (exit 1): el import de `segunda-rfef-g1` crea `alaves-b-2`, `eibar-b-2`, `atletico-astorga` (96 added / 96 missing, 90 problemas de validación); además 3 `renamedAtProvider` (Girona, Sabadell, Bilbao Athletic) impiden `auto-aplicable`. Mientras siga así el bot no abre PR y las correcciones de CA-6 no llegan a `data/calendario/**`.
- **F-SPEC-071-2** (titular): 19 de las correcciones son desfases de 1–23 min por un `horaTexto` no redondo, también fuera de Tercera (p. ej. Atlético–Málaga 21:08). ADR-031 §3 dice «tal cual»; si en Primera–Segunda RFEF se prefiere la hora programada, es otra decisión.
- **F-SPEC-071-3** (nota): si falla la lectura de un día del export, `historico:sync` salta la fecha local entera (como antes) y `calendario:sync` no corrige esa competición (avisa por stderr, no marca fallo). Preferible a una corrección con un vecino ausente.
- **F-SPEC-071-4** (nota): la «fecha de la fila» es el día del export en el que vino (`?date=`), no `fechaIso`; en todas las filas vistas coinciden.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados con test; spec en `en-revision`. Commits `13ba251` (ventana en historico), `5fdd13b` (`realKickoffs`), `40d41f3` (bot), `a63f0ce` (versión 0.5.2) y el de QA/ledger. Sin push. No se ha ejecutado `historico:sync` sin `--dry-run`, ni `calendario:sync` en escritura, ni `calendario:load`: la aplicación real la decide el titular, junto con F-SPEC-071-1/2.
