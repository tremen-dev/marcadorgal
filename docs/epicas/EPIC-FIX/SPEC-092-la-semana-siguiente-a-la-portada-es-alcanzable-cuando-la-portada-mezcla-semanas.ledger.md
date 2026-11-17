---
id: SPEC-092
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-092 La semana siguiente a la portada es alcanzable cuando la portada mezcla semanas

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-092-semana-portada-mixta`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/board/weeks.ts` (`homeWeeks`, `homeWeek`, `homeOf`, `chosenRounds`); fixture `src/board/fixtures/semana-mixta-2026-11.ts` (de `data/calendario/2026-27` en afb4de8) | `src/board/weeks-mixed.test.ts` › «SPEC-092 CA-1 homeWeeks and homeWeek» (T1–T4, índice vacío); `src/board/weeks.test.ts` › SPEC-027 CA-2 sin mezcla intactos | | 🚧 |
| CA-2 | `src/board/weeks.ts` (`homeArrows`); `src/board/week-read.ts` (`readHome` usa `homeArrows`) | `weeks-mixed.test.ts` › «SPEC-092 CA-2 homeArrows» (T1–T4 gl y es, vacío, readHome) | | 🚧 |
| CA-3 | `src/board/week-route.ts` sin cambios: `weekPage` ya decide el 307 con `homeWeek`, ahora H | `weeks-mixed.test.ts` › «SPEC-092 CA-3 weekPage» (T1, T3, T4, 404) | | 🚧 |
| CA-4 | — (propiedad sobre CA-1..CA-3) | `weeks-mixed.test.ts` › «SPEC-092 CA-4 every week reachable» (1633 instantes, (a)–(d)) y «the mix lasts … 02:30Z (N-2)» | | 🚧 |
| CA-5 | `e2e/xornada-weeks.db.spec.ts`, `e2e/xornada-weeks-sen-tira.db.spec.ts`, `e2e/xornada-nav.db.spec.ts`, `e2e/xornada-goleadores-historico.db.spec.ts` (derivan de `homeArrows`/`homeWeek`) | los mismos; NO ejecutados: `e2e:db` necesita Supabase local (Docker apagado en esta máquina) | | 🚧 |
| CA-6 | `package.json`/`package-lock.json` 0.11.0 → 0.11.1 | `npm run typecheck`, `lint`, `test` en worktree LF (4798 passed, 3 skipped; biome 506 ficheros sin errores); `npm run build` OK en árbol principal; `npm run e2e` (árbol principal): 457 passed, 1 skipped (5.5 min); `e2e:db` NO ejecutado (sin Docker); `git diff origin/main --stat -- src/sources src/decide src/ingest src/calendar supabase src/app/api src/components src/board/current.ts src/board/http.ts src/board/reader.ts` vacío | | 🚧 |
| CA-7 | — (campo, post-despliegue) | pendiente: curl en la primera ventana con mezcla tras desplegar (miércoles por la tarde) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-092/. Informe HTML opcional: _qa/SPEC-092/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-092-1, F-SPEC-092-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-092-1 (de la spec, fuera de alcance): sin mezcla, una competición con dos rondas en la semana de la portada deja una sin página. Destino: EPIC-MEJORA.
- F-SPEC-092-2: para que la propiedad CA-4 corra en ~15 s (antes ~160 s), `weeks.ts` guarda las semanas de ronda por array (`WeakMap`, el índice es `readonly`), `inSeason` devuelve el mismo array si ya es la temporada de `now`, y `weekOf` lleva un memo acotado (4096). Sin cambio de semántica; el verificador decide si lo acepta dentro de CA-6. Destino: revisión.
- F-SPEC-092-3: el test de SPEC-027 CA-2 «mixed Wednesday» (2026-10-14T12:00Z) esperaba H = 10-17; por H-1 ahora no hay H (ninguna semana cubierta). Se enmienda en `weeks.test.ts`: H `null`, ‹ `/xornada/2026-10-10` (sigue trayendo Primera J8 y Tercera J6), › `/xornada/2026-10-17`.
- F-SPEC-092-4: en el checkout Windows (`core.autocrlf=true`) `npm run lint` falla por CRLF en ficheros ajenos; lint y test se midieron en un worktree LF. Conocido, no de esta spec.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- H-1, H-2, H-3 según la recomendación de la spec (aprobada por Alberto Fojo el 2026-11-17, commit 10feeb3).
- Hecho: CA-1..CA-4 con tests unitarios en verde; CA-5 e2e reescritos (sin ejecutar); CA-6 versión 0.11.1, typecheck/lint/test (worktree LF) y build en verde, frontera vacía.
- Falta: ejecutar `npm run e2e:db` con Supabase local (Docker) — idealmente un día con mezcla (miércoles tarde) y otro sin ella; CA-7 en campo tras desplegar.
- Comprobación hecha: S y H sobre el fixture coinciden con el calendario completo de `data/calendario/2026-27` en los 1633 instantes del rango (0 diferencias; 792 con mezcla).
