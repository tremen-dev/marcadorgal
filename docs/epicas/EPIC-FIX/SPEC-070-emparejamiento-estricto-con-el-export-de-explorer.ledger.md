---
id: SPEC-070
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-070 Emparejamiento estricto con el export de explorer

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-070-emparejamiento-estricto-con-el-export-de-explorer`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/explorer-identity.ts` (`isSamePublicMatch`, `isSameMatch`, `pickRow`), `src/lib/explorer-enrichment.ts` (`isMatchEqual`, `enrichMatchesWithGoals`), `src/ingest/historico.ts` (`planDaySync`); fixture `src/sources/rfef/fixtures/export/export-2026-11-08-emparejamiento.json` (+ README) | `src/lib/explorer-emparejamiento.test.ts` › «CA-1 the real case of 2026-11-08» (3 casos: `isMatchEqual` false/true, plan 1-2 + 3 goles en los dos órdenes, enriquecimiento) | | ❌ |
| CA-2 | ídem | `src/lib/explorer-emparejamiento.test.ts` › «CA-2 two «Real» of Segunda the same day» (`isMatchEqual`, `planDaySync`, `enrichMatchesWithGoals`) | | |
| CA-3 | `src/lib/explorer-identity.ts` (`sideTeamId`: manda el alias; el canónico solo si el alias no conoce el nombre, y por igualdad) | `src/lib/explorer-emparejamiento.test.ts` › «CA-3 canonical ids of another match» (4 casos, incl. subcadena `sport` → false) | | |
| CA-4 | `src/lib/explorer-identity.ts` (`rowCompetitionId`: `competitions[codGrupo]` ?? `canonicalCompetitionId` ?? null) | `src/lib/explorer-emparejamiento.test.ts` › «CA-4 a row without competition» (2 casos, con y sin alias) | | |
| CA-5 | `src/lib/explorer-identity.ts` (`pickRow`, `madridHour`), `planDaySync` (`ambiguous`), `enrichMatchesWithGoals` (`console.warn`) | `src/lib/explorer-emparejamiento.test.ts` › «CA-5 ambiguity» (plan sin pareja + candidatas, aviso, desempate por `horaTexto`) | | |
| CA-6 | `src/lib/explorer-xornada.ts` (sin `Map` por equipos; filas del día de Madrid del kickoff; `isSameMatch` sin alias + `pickRow`) | `src/lib/explorer-xornada.test.ts` › «SPEC-070 CA-6 …» (3 casos) | | |
| CA-7 | `src/ingest/historico.ts` (`unpaired`/`ambiguous` en el plan, `pairedLine`), `src/ingest/historico-db.ts` (`matchesPaired/Unpaired/Ambiguous`, `pairedLines`, listas), `tools/historico-sync.mjs` (imprime; carga el alias por temporada) | `src/ingest/historico.test.ts` › «SPEC-070 CA-7 the dry-run report» (2 casos; `historicoSync` en dry-run con un `sql` falso de solo lectura) | | |
| CA-8 | tests ajustados (ver Evidencia CA-8) | `npm run typecheck` 0, `npm run lint` 0, `npm run test` 2519 ok + 1 fallo previo ajeno, `next build` 0 | | |
| CA-9 | dry-run real (ver Evidencia CA-9) | `_qa/SPEC-070/dry-run-2026-08-14_2026-11-09.log`, `ca9-check.log`, `ca9-vecinos.log` | | |
| CA-10 | `src/lib/explorer-enrichment.ts`: borrados `normalizeSlug`, `NOISE_WORDS`, `toTokenSet`, `areTeamsSimilar` | `src/lib/explorer-emparejamiento.test.ts` › «CA-10 no approximate names»; `grep` (ver Evidencia) | | |
| CA-11 | `next.config.ts` (`outputFileTracingIncludes` de `/api/board`, `/`, `/es`, `/xornada/*`), `src/ingest/aliases.ts` (`rfefAliasesOrNull`), `src/app/api/board/route.ts`, `src/app/xornada-home.tsx`, `src/app/xornada-week.tsx` | `src/arch/deploy.test.ts` › «SPEC-070 CA-11 …» (5 rutas); `src/ingest/aliases.test.ts` › «SPEC-070 CA-11 rfefAliasesOrNull»; CA-1..5 usan `rfefAliasesOrNull("2026-27")` | | |

## Evidencia del implementador
**Decisiones aplicadas.** (1) Vía del alias en la web (CA-11): **fichero**. Antes no llegaba (0 ocurrencias en el trace de las cinco rutas web, 1 en `/api/ingest/tick`); se añadió a `outputFileTracingIncludes` y ahora llega. Next casa las claves con picomatch `contains`, así que `/` alcanza todas las rutas de servidor. (2) Si en una ruta web el fichero no carga, `rfefAliasesOrNull` devuelve `null` con aviso y la competición sale solo de `canonicalCompetitionId` con igualdad exacta a `pm.competitionId`; una fila sin competición resoluble no empareja (decisión del orquestador, punto 1 de la petición del titular). (3) Ids de equipo del partido público: sufijo N-2 comparado con `<local>-<visitante>` resueltos de la fila; en `historico:sync`, `m.home_team_id`/`m.away_team_id` de `public.matches`. (4) Xornada femenina: sin alias (`canonical*` exacto; se conserva la variante sin `-femenino` del calendario que ya existía); el `matchKey` deja de ser llave (no es identidad).

**CA-1..7, 10, 11** (worktree LF `D:/src/tremen-dev/wt-070`):
```
$ npx vitest run src/lib/explorer-emparejamiento.test.ts src/ingest/historico.test.ts src/lib/explorer-xornada.test.ts src/lib/explorer-enrichment.test.ts src/arch/deploy.test.ts src/ingest/aliases.test.ts
 Test Files  6 passed (6)
      Tests  85 passed (85)
```
Rojo antes de implementar: `explorer-emparejamiento.test.ts` 10 de 16 (p. ej. CA-10 `expected true to be false`); CA-6 3 (`expected { home: 5, away: +0 } to deeply equal { home: 2, away: +0 }`); CA-11 7 (`rfefAliasesOrNull is not a function`, rutas sin entrada).

**CA-8** — tests ajustados: `explorer-enrichment.test.ts` «matches by normalized team names…» pasa a «does not match by similar names…» (`false`): fijaba el emparejamiento por nombres. `historico.test.ts`: `MatchToSync` lleva `homeTeamId`/`awayTeamId` (la identidad los necesita). `explorer-xornada.test.ts`: la fila de Liga F lleva `canonicalCompetitionId: "liga-f"` (sin competición ya no se usa). `historico.db.test.ts` sin cambios (ids canónicos iguales; no ejecutado: requiere Docker).
```
$ npm run typecheck && npm run lint && npm run test     # worktree LF
Checked 433 files in 1292ms. No fixes applied.
 Test Files  1 failed | 151 passed (152)
      Tests  1 failed | 2519 passed | 3 skipped (2523)
 FAIL  src/db/test-db.test.ts > SPEC-022 CA-1 local Storage forced over the .env > wins over a .env file in the cwd too
$ git checkout --detach 98c96b2 && npx vitest run src/db/test-db.test.ts   # base, sin SPEC-070
      Tests  1 failed | 10 passed (11)          # el mismo fallo: previo y ajeno (F-SPEC-070-4)
$ npx next build      # árbol principal
exit=0
```

**CA-10**
```
$ grep -rn "areTeamsSimilar\|NOISE_WORDS" src/ ; echo $?
1
```

**CA-11** — `_qa/SPEC-070/ca11-nft.txt` (`data/alias/2026-27/rfef.json` en `.next/server/app/**/*.nft.json`):
```
antes (98c96b2)  api/board 0 · (gl)/page 0 · (es)/es/page 0 · (gl)/xornada/[fecha] 0 · (es)/es/xornada/[fecha] 0 · api/ingest/tick 1
después (rama)   las seis rutas → data/alias/2026-27/rfef.json
```

**CA-9** — solo lectura; token = `ADMIN_API_KEY` de explorer en el entorno del proceso:
```
$ RFEF_EXPLORER_TOKEN=<ADMIN_API_KEY explorer> npm run historico:sync -- --dry-run --desde 2026-08-14 --hasta 2026-11-09
  Datas procesadas: 61 · Partidos analizados: 553 · consolidados: 278 · Goles: 694
  Partidos emparejados:   533
  Sen emparejar:          20
  Ambiguos:               0
  2026-11-08 · segunda-division-2026-27-j13-sporting-valladolid · 70695047 · Real Sporting de Gijón–Real Valladolid CF · 1-2 · 3 goles
$ node docs/epicas/EPIC-FIX/_qa/SPEC-070/ca9-check.mjs <log>     # rival distinto; implementación independiente (alias + calendario declarado)
emparejados=533 rival_distinto=0 ambos_lados_por_alias=533 algun_lado_por_id_canonico=0 sin_calendario=0
$ node docs/epicas/EPIC-FIX/_qa/SPEC-070/ca9-vecinos.mjs <log>   # dónde está la fila de cada sin emparejar (export de ±3 días)
```
Causas de los 20 sin emparejar (todas `no_identity`: hay filas de su competición ese día, ninguna con sus dos equipos):
- **17 jugados otro día** (kickoff en base ≠ día real): Segunda J12 ×8 (31-10 o 02-11), Tercera J8 ×2 (24-10), Tercera J9 ×2 (31-10), Tercera J10 ×5 (07-11). Su fila está en el export de ese otro día, `FINISHED`.
- **2 aplazados** en otro día: Castellón–Eibar (06-11) y Granada–Tenerife (07-11), `POSTPONED` sin marcador.
- **1 sin fila en ±3 días**: Rayo Vallecano–Athletic Club, Primera J8, 2026-10-10.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-070/. Informe HTML opcional: _qa/SPEC-070/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-070-1, F-SPEC-070-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-070-1** (→ F-SPEC-069-2 / EPIC-MANT): 19 partidos del rango tienen en base un kickoff de otro día (fecha provisional del calendario o aplazamiento); `historico:sync` pide el export por ese día y no los encuentra. Recuperarlos exige reprogramar el kickoff o mirar días vecinos: fuera de alcance.
- **F-SPEC-070-2** (→ EPIC-MANT): Rayo–Athletic (Primera J8, 2026-10-10) no tiene fila en el export ni en ±3 días.
- **F-SPEC-070-3** (→ EPIC-MEJORA): por la semántica `contains` de `outputFileTracingIncludes`, la clave `/` lleva `rfef.json` (22 KB) a todas las rutas de servidor. Inocuo.
- **F-SPEC-070-4** (→ EPIC-MANT, ajeno): `src/db/test-db.test.ts` «wins over a .env file in the cwd too» falla también en la base `98c96b2` en esta máquina.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Hecho: CA-1..CA-11 implementados con test; dry-run de CA-9 ejecutado (solo lectura), salida en `_qa/SPEC-070/`. Versión 0.5.1 (patch, ADR-028). Falta: verificación (`sdd-verificador`), PR y, si el titular lo decide tras ver CA-9, `historico:sync` en real (fuera de alcance). La identidad vive en `src/lib/explorer-identity.ts`; la usan `explorer-enrichment.ts`, `historico.ts` y `explorer-xornada.ts`.
