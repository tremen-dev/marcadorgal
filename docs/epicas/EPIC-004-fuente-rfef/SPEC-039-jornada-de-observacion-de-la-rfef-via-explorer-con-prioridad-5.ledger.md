---
id: SPEC-039
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-039 Jornada de observación de la rfef vía explorer con prioridad 5

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-039-jornada-de-observacion-de-la-rfef-via-explorer-con-prioridad-5`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/ingest/informe-rfef.ts` (`informeRfef`, puro), `src/ingest/informe-rfef-db.ts` (`informeRfefFilas`), `tools/informe-rfef.mjs`, `package.json` (`informe:rfef`) | `src/ingest/informe-rfef.test.ts`: «CA-1 (a)…(f)», «CA-1 npm run informe:rfef»; `src/ingest/informe-rfef.db.test.ts` (test:db) | | 🚧 |
| CA-2 | `src/ingest/informe-rfef.ts` (`actaDe`: export del día siguiente resuelto con el propio `createRfefExplorer`; tabla y apéndice por partido) | `informe-rfef.test.ts`: «CA-2 contraste con acta cerrada» (triples, ≠ por fuente, sin acta, dígitos falsos, export del mismo día rechazado) | | 🚧 |
| CA-3 | Pendiente: jornada real 2026-11-07/08 en producción (titular). La herramienta y el formato de `--evidencia` están listos | — (operativo, no testeable en repo) | | ❌ |
| CA-4 | `src/ingest/informe-rfef.ts` (`criterioDe`, tabla final) | `informe-rfef.test.ts`: «CA-4 criterio de subida», un caso por condición (i)…(v), «reserva útil» y la fila por competición | | 🚧 |
| CA-5 | Corte `## Apéndice`; diff limitado a `src/ingest/informe-rfef*.ts`, `tools/`, `package.json` | `informe-rfef.test.ts`: «CA-5 una página y función pura» (≤ 80 líneas, sin reloj/red/fs) | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-039/. Informe HTML opcional: _qa/SPEC-039/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-039-1, F-SPEC-039-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-039-1 (sdd-arquitecto, aclarar CA-1 b).** `observations` no tiene `recorded_at` (ADR-016 solo lo añadió a `decisions`; `ingest_attempts.opened_at`). Implementado como segundo reloj de la observación: `storage.objects.created_at` de su `raw_ref` (ADR-016 §3) y, si no está, `opened_at` del intento con ese `raw_ref`; sin ninguno, el par cuenta como «sin segundo reloj». Sin migración (CA-5).
- **F-SPEC-039-2 (sdd-arquitecto, aclarar CA-1 c).** «API-Football no daba directo» se juzga con las observaciones de API-Football (ninguna en `SILENCE_MINUTES` = 15 min o `scheduled` con el kickoff pasado), no con la Decision publicada: con la rfef de reserva la Decision ya no sale `sen_sinal`. Cada intervalo entre lecturas `live` de la rfef se tapa a `OBSERVATION_WINDOW_MINUTES` (5).
- **F-SPEC-039-3 (decisión de implementación).** Δ solo sobre marcadores vistos en `live` por las dos fuentes (0-0 excluido); un `finished` recuperado (SPEC-044) no entra en el desfase. (iv) se mide sobre las filas del export con marcador (`none:scheduled` sin marcador no cuenta).
- **F-SPEC-039-4 (titular, CA-3/CA-4 iii-v).** explorer no es de este repo: sus cifras y el registro de intervenciones entran por `--evidencia <json>` (esquema `Evidencia` en `informe-rfef.ts`: `explorer.{capturadoEn, health, sesiones, softBlocks, sondeosSaltados, cooldowns[{inicio,fin}], anomalias[{competicion,detalle}]}`, `intervenciones[{instante,competicion,motivo}]`). Sin ese fichero (iii) y (v) salen «no» y nunca se recomienda 50 por omisión.
- **F-SPEC-039-5 (entorno, no de esta spec).** En Windows la suite tiene 13 fallos de fondo idénticos en `main` (8282501): `calendar/cli`, `db/test-db`, `design/fonts`, `design/no-hex`. CI (Linux) no los ve.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Hecho (2026-11-02, sdd-implementador):** CA-1, CA-2, CA-4 y CA-5 en código y tests. Evidencia: `npx vitest run src/ingest/informe-rfef.test.ts` → 29 passed; `npx vitest run --config vitest.db.config.mts src/ingest/informe-rfef.db.test.ts` contra `supabase start` → 1 passed; worktree LF: `tsc --noEmit` 0, `biome check .` 0 errores (1 warning previo en `src/arch/deploy.test.ts`), `vitest run` solo con los 13 fallos de fondo de F-SPEC-039-5; `npm run build` OK en el árbol principal. Humo local: `informe:rfef` con los exports reales de `src/sources/rfef/fixtures/export/` resuelve el acta de las cinco competiciones (Tercera 9/9).

**Falta: CA-3, la jornada real (2026-11-07/08, H-4).** No se puede hacer antes del fin de semana. Pasos:
1. Durante la jornada, nada que tocar; anotar cualquier intervención manual (alias, parseo, ofuscación) con instante y competición.
2. Al cierre de cada día (después del último partido), guardar el export: `curl -s -H "Authorization: Bearer $TOKEN" "https://marcadorgal-explorer.vercel.app/api/export/matches?date=YYYY-MM-DD" > docs/epicas/EPIC-004-fuente-rfef/_qa/SPEC-039/export-YYYY-MM-DD-dia.json` (en local el token es la `ADMIN_API_KEY` de explorer). El día siguiente, el mismo `date` a `export-YYYY-MM-DD-acta.json`.
3. Al cierre: `/api/health`, sesiones, soft-blocks, intervalos de cooldown, sondeos saltados y anomalías de explorer → `_qa/SPEC-039/evidencia.json` con el esquema de F-SPEC-039-4.
4. `npm run informe:rfef -- 2026-11-06T17:00Z 2026-11-09T22:00Z --export _qa/…/export-*-dia.json --acta _qa/…/export-*-acta.json --evidencia _qa/…/evidencia.json` (contra producción, solo lectura) → `_qa/SPEC-039/2026-11-06-informe.md`.
5. `npm run informe:jornada -- <desde> <hasta> --contrastar --salida _qa/SPEC-039/…` (SPEC-017) y explicar en su texto los `conflict` atribuibles a la rfef (H-2).
6. Anotar la evidencia de explorer en este ledger. La decisión de subir es del titular (ADR posterior).
