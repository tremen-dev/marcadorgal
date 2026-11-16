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
| CA-1 | `src/lib/explorer-xornada.ts` (`rowsByDate` sin el día ilegible + `continue`; `ambiguous` → `continue`) | `src/lib/explorer-xornada.spec086.test.ts` › CA-1 (rechaza / sin `matches`); `explorer-xornada.test.ts` › SPEC-070 CA-6 «two rows… does not come out» | | ❌ |
| CA-2 | `src/lib/explorer-xornada.ts` `viewOf` → `explorerRowState` de `src/sources/rfef/explorer.ts` (exportada) | `src/lib/explorer-xornada.spec086.test.ts` › CA-2 (9 casos sin marcador, 3 con marcador) | | ❌ |
| CA-3 | `src/lib/explorer-xornada.ts` `viewOf` → `explorerRowState` (`inLiveWindow` 130/140, minuto ≤130, añadido ≤30) | `src/lib/explorer-xornada.spec086.test.ts` › CA-3 (−11, −10, +129, +130, +139 minuto, +139 descanso, +140 minuto; acotado) | | ❌ |
| CA-4 | `src/lib/explorer-xornada.ts` `sanitizeGoals(dayMatch?.goals ?? [])`, `goals` solo si hay alguno | `src/lib/explorer-xornada.spec086.test.ts` › CA-4 (solo el válido; ninguno → sin `goals`) | | ❌ |
| CA-5 | `src/lib/explorer-xornada.ts` `PublicMatch.safeParse` por partido + `console.warn` con `externalId` | `src/lib/explorer-xornada.spec086.test.ts` › CA-5 (kickoff no ISO) | | ❌ |
| CA-6 | `src/lib/explorer-client.ts` (`lastSeenAt?`); `src/lib/explorer-xornada.ts` `viewOf` (`Instant.safeParse`), `version`/`observedAt`/`decidedAt` | `src/lib/explorer-xornada.spec086.test.ts` › CA-6 (relojes; sin/no ISO/sin Z/POSTPONED sin `lastSeenAt`) | | ❌ |
| CA-7 | `src/lib/explorer-xornada.ts` (sin `nowIso` en la salida) | `src/lib/explorer-xornada.spec086.test.ts` › CA-7 (`toEqual` + `boardEtag`) | | ❌ |
| CA-8 | `src/lib/explorer-xornada.ts` (`observedAt = lastSeenAt`) | `src/lib/explorer-xornada.spec086.test.ts` › CA-8 (`rowAge` = 5) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-086/. Informe HTML opcional: _qa/SPEC-086/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-086-1, F-SPEC-086-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-086-1 (riesgo de campo, verificador): todo partido femenino no programado depende ahora de que el export de producción traiga `lastSeenAt` ISO con `Z`; si no lo trae, desaparece (CA-6). Comprobar con una lectura real de `/api/export/matches` antes del merge.
- F-SPEC-086-2 (EPIC-MEJORA): el `console.warn` de ambigüedad usa `candidateOf`, que lee nombres (`homeTeam`/`equipoLocal`); con filas que solo traen ids canónicos imprime `?–?`.
- F-SPEC-086-3 (nota): `explorerRowState` acepta `kickoff: string` (antes `Instant`); la ingesta le sigue pasando el `Instant` del calendario. Sin cambio de comportamiento.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
CA-1..CA-8 implementados en `ft/SPEC-086-femenino-sin-degradar` (commits `6fe3cd2` refactor, `ee9d820` fix, `b04fe04` versión 0.10.8). Gates locales: typecheck, lint y `npm test` (175 ficheros, 2976 tests) verdes en worktree LF; `next build` verde en el árbol principal. Falta: verificación (sdd-verificador), F-SPEC-086-1 contra el export real, push y PR.
