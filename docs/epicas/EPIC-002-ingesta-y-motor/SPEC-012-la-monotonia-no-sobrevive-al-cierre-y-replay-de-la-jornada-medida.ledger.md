---
id: SPEC-012
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-012 La monotonía no sobrevive al cierre y replay de la jornada medida

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-012-la-monotonia-no-sobrevive-al-cierre-y-replay-de-la-jornada-medida`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `docs/fundacion/reglas.md` RN-03 enmendada por el arquitecto · 71ae5e5 (F-SPEC-012-1 cerrado) | `src/arch/reglas-rn03.test.ts` (4 casos, verdes) | | |
| CA-2 | `src/decide/engine.ts` (cierre forzoso con la ganadora fresca; RN-03 no rige en la transición a `finished`) · c29e746 | `src/decide/engine.test.ts` › «SPEC-012 CA-2 …» (i)–(v); rojo 3/5 antes, 76/76 `src/decide` después | | |
| CA-3 | `src/decide/replay.ts` (opción `engine`) · `src/decide/fixtures/engine-812c805.ts` (motor de la jornada, congelado) · fixture real `src/sources/api-football/fixtures/girona-albacete-2026-09-25.json.br` + fila en su `README.md` · 1947815, 0aaf277 | `src/decide/replay.test.ts` › «SPEC-012 CA-3 the replay of girona-albacete…» (3): 247 capturas → 247 observaciones del partido con el parpadeo `live 2-1`; `finished 2-1` (RN-03) con 812c805; `finished 2-0` (RN-01) con el de hoy | | |
| CA-4 | `src/ingest/replay-jornada.ts` (puro) · `src/ingest/replay-jornada-db.ts` · `tools/replay-jornada.mjs` · script `replay:jornada` · 2124389 | `src/ingest/replay-jornada.test.ts` (5) · `src/ingest/replay-jornada.db.test.ts` (1, con rollback) · ejecución real abajo | | |
| CA-5 | Este ledger, «Evidencia CA-4/CA-5» | Contraste recalculado sin proveedor: 32 → 37 de 39 | | |
| CA-6 | `_qa/SPEC-012/correccion-jornada-2026-09-29.md`; informe de SPEC-009 intacto | `npm run gates` (sin CA-1) exit 0, también sin env; `npm run test:db` exit 0; `git diff main --stat -- supabase` vacío | | |

## Evidencia CA-4/CA-5 (2026-09-29, ventana `2026-09-25T18:20Z → 2026-09-28T21:00Z`)

- En seco: `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` → `39 partidos, 5 divergen, 5 con corrección.` Divergen exactamente girona-albacete, lugo-racing-ferrol, celta-fortuna-sabadell, mirandes-unionistas y burgos-eldense; `eibar-las-palmas` 3-2 y `barakaldo-aviles` 3-3 **no** divergen (N-2).
- Fidelidad: el mismo replay con `engine-812c805` → **0 de 39** divergen de `board`.
- `--aplicar`, una sola vez: `decisions 3351 → 3356 (+5), decided_at 2026-09-29T00:09:14.708Z`.
- Conteos antes → después: `decisions` 3351 → 3356 · `observations` 9341 → 9341 · `alerts` 17 (17 abiertas) → 17 (17 abiertas) · `ingest_attempts` 2766 → 2766 · `raw_purges` 8 → 8. Tras `npm run test:db`: igual (3356).
- Filas nuevas (`decided_at >= 2026-09-29`): 5, todas `finished`, `provisional`, `minute` null, `rule` RN-02, una observación citada.

| Partido | board antes (v) | board después (v) | observation_ids |
|---|---|---|---|
| girona-albacete | 2-1 (100) | **2-0** (101) | e39871fc-3f27-4922-8b88-7cacfa506ffa |
| lugo-racing-ferrol | 1-1 (105) | **1-0** (106) | bd69ae7c-59d4-4e3a-8f26-f7e08d42e96e |
| celta-fortuna-sabadell | 1-2 (101) | **1-1** (102) | 84b3e126-b595-41bf-9468-b2d1bb06ce36 |
| mirandes-unionistas | 0-1 (107) | **1-0** (108) | e6abc3e3-4b06-430b-9b15-23b76f540f0e |
| burgos-eldense | 0-1 (97) | **1-0** (98) | 94b14a03-fa5f-4d64-b602-d5604ac755c9 |
| ceuta-real-sociedad-b | 2-1 (107) | 2-1 (107) | — |
| merida-logrones | 3-4 (107) | 3-4 (107) | — |

- **CA-5.** `ceuta-real-sociedad-b` (board 2-1, proveedor 3-1) y `merida-logrones` (board 3-4, proveedor 3-5) **siguen mal al cerrar esta spec**: su última observación guardada coincide con lo publicado, no hay nada retenido que soltar y el replay no puede inventar el dato que no se capturó (SPEC-009 N-9). Destino: **SPEC-013**. Contraste con el marcador del proveedor del bloque 8 del informe del 2026-09-28 (sin nueva petición, RN-08): **32 de 39 → 37 de 39**.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-012/. Informe HTML opcional: _qa/SPEC-012/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-012-1, F-SPEC-012-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-012-1 — CA-1 sin aplicar (destino: sdd-arquitecto) — CERRADO en 71ae5e5; `src/arch/reglas-rn03.test.ts` 4/4 verde.** `reglas.md` es documento de verdad y el hook bloquea al implementador. Texto que el test exige, sustituyendo las tres líneas actuales de RN-03:
  ```
  - **RN-03 — Monotonía.** Un marcador no baja salvo por el operador **mientras
    el partido está en juego**. Si la fuente ganadora propone un marcador menor
    que el vigente, se mantiene el vigente y se abre una Alert. **La retención
    no sobrevive al cierre: al pasar a `finished`, manda el marcador de la
    observación ganadora.**
    *Enmendada el 2026-09-29 por ADR-010 §1.*
  ```
  Con eso `src/arch/reglas-rn03.test.ts` pasa a verde y `npm run gates` a exit 0.
- **F-SPEC-012-2 — Fixture real de CA-3 — CERRADO 2026-09-29 (autorización de Alberto Fojo, 2026-09-29).** `src/sources/api-football/fixtures/girona-albacete-2026-09-25.json.br`: 247 `RawCapture` del raw store (`ids=1569941`, 18:20:00Z → 20:23:06Z), array por `capturedAt`, **9 458 962 bytes en claro → 21 706 en brotli**. Tres muestras (primera, 121.ª, última) descargadas de nuevo del bucket `raw` y comparadas con `cmp`: idénticas. Sin secretos: `git grep -cF "$API_FOOTBALL_KEY"` → 0 ficheros; sobre el contenido descomprimido, 0 coincidencias de `API_FOOTBALL_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_PASSWORD`, `INGEST_TICK_TOKEN`, `CRON_SECRET`, y 0 de `x-apisports`, `apikey`, `authorization`, `user-agent`, `headers`. `npm run gates` exit 0 (724 tests) · `npm run test:db` exit 0 (72).
- **F-SPEC-012-3 — FOUNDATION parafrasea la RN-03 vieja (destino: sdd-arquitecto/producto).** El no-negociable «Un marcador no baja salvo por el operador (RN-03)» no dice «mientras el partido está en juego».
- **F-SPEC-012-4 — Cierres duplicados en la jornada (destino: sdd-arquitecto).** `lugo-racing-ferrol` tiene dos Decisions RN-02 con la misma tupla (v104/v105) y `ceuta-real-sociedad-b` dos con `decided_at` invertido (v106 14:00:06Z, v107 14:00:03Z): huella de hook y barrido cerrando en paralelo. No afecta al marcador; no se ha tocado.
- **F-SPEC-012-5 — Nota de alcance.** `git diff main -- package.json` muestra también `informe:jornada`, que es de SPEC-009 (PR #16 sin mergear); respecto a 812c805 esta spec añade solo `replay:jornada`. La alerta `forced_finish` sigue guardando en `details.score` el marcador vigente, no el publicado; CA-2 no lo pide.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1 (71ae5e5, arquitecto), CA-2, CA-3 sobre el crudo real (0aaf277), CA-4 (aplicado una vez en `dev`, +5 Decisions), CA-5, CA-6. F-SPEC-012-1 y -2 cerrados.
- Falta: verificación. **No volver a ejecutar `--aplicar`**: hoy el replay no diverge en ningún partido y no escribiría nada.
- Comprobación rápida: `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` debe dar `0 divergen`; `npx vitest run src/decide/replay.test.ts` en verde.
