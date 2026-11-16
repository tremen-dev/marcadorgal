---
id: SPEC-086
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-086 La xornada femenina no degrada ni inventa ante un fallo o un hueco de explorer

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-086-femenino-sin-degradar`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/explorer-xornada.ts` (`rowsByDate` sin el día ilegible + `continue`; `ambiguous` → `continue`) | `src/lib/explorer-xornada.spec086.test.ts` › CA-1 (rechaza / sin `matches`); `explorer-xornada.test.ts` › SPEC-070 CA-6 «two rows… does not come out» | spec086 CA-1 2/2 verde; mutante «sin `continue` del día ilegible» → 2 rojos; sonda extra: `dayMatches` resuelve `null` → `[]` | ✅ |
| CA-2 | `src/lib/explorer-xornada.ts` `viewOf` → `explorerRowState` de `src/sources/rfef/explorer.ts` (exportada) | `src/lib/explorer-xornada.spec086.test.ts` › CA-2 (9 casos sin marcador, 3 con marcador) | spec086 CA-2 12/12 verde; regla única `explorerRowState` (`scoreOf` exige ambos lados); sonda: marcador `"2"` (string) → descartado sin tirar el otro | ✅ |
| CA-3 | `src/lib/explorer-xornada.ts` `viewOf` → `explorerRowState` (`inLiveWindow` 130/140, minuto ≤130, añadido ≤30) | `src/lib/explorer-xornada.spec086.test.ts` › CA-3 (−11, −10, +129, +130, +139 minuto, +139 descanso, +140 minuto; acotado) | spec086 CA-3 8/8 verde (los 5 casos del CA + descanso, +140, acotado 130/30) | ✅ |
| CA-4 | `src/lib/explorer-xornada.ts` `sanitizeGoals(dayMatch?.goals ?? [])`, `goals` solo si hay alguno | `src/lib/explorer-xornada.spec086.test.ts` › CA-4 (solo el válido; ninguno → sin `goals`) | spec086 CA-4 2/2 verde; `sanitizeGoals` descarta `Goleador *`, sin `player`, `minute` no numérico | ✅ |
| CA-5 | `src/lib/explorer-xornada.ts` `PublicMatch.safeParse` por partido + `console.warn` con `externalId` | `src/lib/explorer-xornada.spec086.test.ts` › CA-5 (kickoff no ISO) | spec086 CA-5 verde; sonda: kickoff `mañana` → sale solo el válido, sin excepción (`toMadridDate` no lanza con NaN) | ✅ |
| CA-6 | `src/lib/explorer-client.ts` (`lastSeenAt?`); `src/lib/explorer-xornada.ts` `viewOf` (`Instant.safeParse`), `version`/`observedAt`/`decidedAt` | `src/lib/explorer-xornada.spec086.test.ts` › CA-6 (relojes; sin/no ISO/sin Z/POSTPONED sin `lastSeenAt`) | spec086 CA-6 5/5 verde; mutante `observedAt: nowIso` → rojo. Campo: export real (5 días, 103 filas) con `lastSeenAt` válido para `Instant` en el 100 % | ✅ |
| CA-7 | `src/lib/explorer-xornada.ts` (sin `nowIso` en la salida) | `src/lib/explorer-xornada.spec086.test.ts` › CA-7 (`toEqual` + `boardEtag`) | spec086 CA-7 verde; mutante `observedAt: nowIso` → rojo | ✅ |
| CA-8 | `src/lib/explorer-xornada.ts` (`observedAt = lastSeenAt`) | `src/lib/explorer-xornada.spec086.test.ts` › CA-8 (`rowAge` = 5) | spec086 CA-8 verde; mutante `observedAt: nowIso` → rojo | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-16** (HEAD `3231726`).
- Worktree LF: `npm run typecheck` ok; `npm run lint` «Checked 491 files… No fixes applied»; `npm test` «175 passed, 2976 passed | 3 skipped». `next build` (árbol principal) exit 0.
- Mutantes (revertidos): quitar el `continue` del día ilegible → 2 rojos CA-1; `observedAt: nowIso` → rojos CA-6/CA-7/CA-8.
- Sondas desechables (no commiteadas, 4/4 verdes): kickoff `mañana`, `dayMatches` → `null`, marcador string, `SUSPENDED` con `homeScore 0` + `golesVisitante 0` → 0-0 de la fila.
- Campo (solo lectura, `GET /api/export/matches` producción, días 08, 09, 14, 15 y 16-11): 103 filas, 0 con `lastSeenAt` no válido para `z.iso.datetime()` (formato `toISOString()` con ms y `Z`). F-SPEC-086-1 cerrado en formato.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-086/. Informe HTML opcional: _qa/SPEC-086/informe.html -->
n-a: ningún CA es de interfaz (construcción de datos de `src/lib`); sin capturas.

## Salvedades / follow-ups
<!-- IDs F-SPEC-086-1, F-SPEC-086-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-086-1 (riesgo de campo, verificador): todo partido femenino no programado depende ahora de que el export de producción traiga `lastSeenAt` ISO con `Z`; si no lo trae, desaparece (CA-6). Comprobar con una lectura real de `/api/export/matches` antes del merge.
- F-SPEC-086-2 (EPIC-MEJORA): el `console.warn` de ambigüedad usa `candidateOf`, que lee nombres (`homeTeam`/`equipoLocal`); con filas que solo traen ids canónicos imprime `?–?`.
- F-SPEC-086-4 (verificador, fuera de alcance; identidad SPEC-070): en el export real de esos 5 días ninguna fila trae `canonicalCompetitionId` femenino (19 filas sin el campo; p. ej. 08-11 «VICTORIA C.F. – Real Racing Club de Santander», probable 2ª Fed. Fem. G1), así que es probable que hoy el femenino no empareje y sale `scheduled` por la rama «sin fila». Revisar en explorer o en la identidad.
- F-SPEC-086-3 (nota): `explorerRowState` acepta `kickoff: string` (antes `Instant`); la ingesta le sigue pasando el `Instant` del calendario. Sin cambio de comportamiento.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados en `ft/SPEC-086-femenino-sin-degradar` (commits `6fe3cd2` refactor, `ee9d820` fix, `b04fe04` versión 0.10.8). Gates locales: typecheck, lint y `npm test` (175 ficheros, 2976 tests) verdes en worktree LF; `next build` verde en el árbol principal. Falta: verificación (sdd-verificador), F-SPEC-086-1 contra el export real, push y PR.
