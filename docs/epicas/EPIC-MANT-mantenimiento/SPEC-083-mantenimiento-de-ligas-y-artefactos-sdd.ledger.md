---
id: SPEC-083
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-083 Mantenimiento de ligas y artefactos sdd

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-083-mantenimiento-ligas-y-artefactos`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/league-preferences.ts` (sin `featuredBadge`), `src/components/xornada/LeaguesPreferencesDialog.tsx`, `Xornada.module.css` (sin `.itemBadge`), `src/components/navigation/CompetitionNav.tsx` y `.module.css` (sin etiquetas ni `.featuredTeamTag`); b2fc0a4 | `src/lib/league-preferences.test.ts` «SPEC-083 CA-1 no item carries a featured team badge»; `src/components/navigation/CompetitionNav.test.ts` «SPEC-083 CA-1 no pill names a team»; `src/components/competition/CompetitionHeader.test.ts` «CA-1 the featured team is still shown»; `e2e/ligas-preferencias.spec.ts` «CA-3 switches named…» (gl/es: ningún switch contiene nombre ni shortName de `GALICIAN_CLUBS`) | Vitest verde; e2e «CA-3 switches named…» gl/es ok; flujo real :3200 gl/es: panel 8 switches, 0 nombres de `GALICIAN_CLUBS`, 0 `itemBadge`; `CompetitionNav` 8 pills, 0 equipos, 0 `.featuredTeamTag`; la cabecera mantiene `featured-galician-club` (Deportivo ABANCA) | ✅ |
| CA-2 | `src/design/league-color.ts` (`leagueColor`), `src/model/competitions.ts` (sin `color`/`accentColor`), `src/model/clubs.ts` (sin `colors`), `CompetitionHeader.tsx`, `CompetitionNav.tsx`, `DirectosView.tsx` (fallback `var(--marca)` para id sin token); HERENCIA.md entrada CA-2; b2fc0a4 | `CompetitionNav.test.ts` «SPEC-083 CA-2 each dot is var(--liga-<id>)»; `CompetitionHeader.test.ts` «CA-2 the badge is var(--liga-<id>) for every competition»; `DirectosView.test.ts` «SPEC-083 CA-2 … each section's dot»; `src/model/competitions.test.ts` «SPEC-083 CA-2 the metadata carries no colour»; `src/model/clubs.test.ts` «SPEC-083 CA-2 no club carries colours» | Vitest verde; flujo real gl/es: nav 8/8 `var(--liga-<id>)`; cabecera liga-f `rgb(228,0,124)` y primera-division `rgb(239,68,68)` (#EF4444); `/directos?date=2026-11-08` con Explorer simulado (8 ligas): 8/8 puntos `var(--liga-<id>)`, color computado = token | ✅ |
| CA-3 | `src/design/no-hex.test.ts` (patrón `rgb(`/`rgba(`/`hsl(`/`hsla(` en `src/**/*.{ts,tsx}` salvo `tokens.ts` y `*.test.ts(x)`); b2fc0a4 | `src/design/no-hex.test.ts` «SPEC-083 CA-3 …» (2 casos; antes de CA-2 fallaba con `competitions.ts` y `clubs.ts`) | `no-hex.test.ts` escanea `src/**/*.{ts,tsx}` salvo `tokens.ts` y tests; verde; `git diff 4334fd6..HEAD -- src` sin `rgb(` añadidos | ✅ |
| CA-4 | `src/xornada/filter.ts` (`emptyReason`), `src/components/xornada/XornadaBody.tsx` (`data-empty-filter`/`data-empty-leagues`), `XornadaFilters.tsx` (aplica la preferencia guardada y la del evento antes de decidir el vacío), `src/i18n/gl.ts`/`es.ts` (`xornada.leaguesEmpty`); HERENCIA.md entrada CA-4; f9a7151 | `src/xornada/filter.test.ts` «SPEC-083 CA-4 emptyReason» (4 casos); `src/i18n/i18n.test.ts` «SPEC-083 CA-4 leaguesEmpty in gl and es»; `e2e/ligas-preferencias.spec.ts` «SPEC-083 CA-4 the empty state names the leagues» (gl y es: preset `Feminino`, recarga, `Todas` lo oculta, `#d=2026-10-02&f=live` con y sin recarga sigue `xornada.empty`) | e2e «SPEC-083 CA-4» gl y es ok; flujo real gl/es a 1440 y 360: preset `Feminino` → `xornada-empty` visible con el texto exacto de `leaguesEmpty`, igual tras recargar; `Todas` lo oculta | ✅ |
| CA-5 | `docs/diseno/Global.tpl.html` (comentario SPEC-082 en lugar de `gl·es`, sin `LANG_*`/`glStyle`/`setGl`), `Global.dc.html` regenerado con `node build.mjs` (solo cambia `Global.*`), HERENCIA.md entrada CA-5; 5b6c800 | `src/design/artboards.test.ts` «SPEC-083 CA-5 Global without gl·es» (4 casos) | `Global.tpl.html`/`.dc.html` sin `glStyle`/`setGl`/`LANG_*`, solo el comentario SPEC-082; `node build.mjs` regenera sin diff; entrada CA-5 en HERENCIA.md | ✅ |
| CA-6 | Frontmatter `id`/`tipo: ledger`/`epica` en los ledgers de SPEC-050, 051, 057, 058, 059, 060 (EPIC-003) y 062 (EPIC-004); títulos de matriz y veredicto RED de 1ª y 2ª ronda de SPEC-057 con «(superada: ver 3ª ronda, GREEN)»; 784bcb9 | `node valida.mjs` → `[valida] OK` (antes 7 errores «sin frontmatter o sin 'id'») | `valida.mjs` → `[valida] OK` (exit 0) | ✅ |
| CA-7 | Hecho por el orquestador con autorización expresa del titular en 4334fd6 (SPEC-059 `feito` → `en-revision`; SPEC-062 `implementada` → `bloqueada`, luego `aprobada` por el titular). El implementador no tocó sus estados | n-a (fuera del implementador) | SPEC-059 `estado: en-revision` (historial misma fecha y firma); SPEC-062 `bloqueada` → `aprobada` (Alberto Fojo, 2026-11-11); commit 4334fd6 | ✅ |
| CA-8 | Versión 0.10.0 → 0.10.1 (`npm version patch --no-git-tag-version`, 567d9d1); `git diff 4334fd6 -- src` sin `font:` ni hex añadidos | 2026-11-11, host Windows (autocrlf=false): `valida.mjs` → `[valida] OK`; `npm run gates` exit 0 (vitest 172 ficheros, 2890 passed / 3 skipped; biome 486 ficheros sin errores; build OK); `npx playwright test` exit 0 (433 passed, 1 skipped, 4.9 min) | 2026-11-11 host Windows: `npm run gates` exit 0 (172 ficheros, 2890 passed / 3 skipped; biome 486 sin errores; build OK); `npx playwright test` 433 passed / 1 skipped (6.2 min), incluidas SPEC-057 y SPEC-082; versión 0.10.1 (patch); sin `font:` ni hex añadidos bajo `src/` | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-11.** CA-1..CA-8 ✅. Gates exit 0, Playwright 433 passed / 1 skipped, `valida.mjs` OK, flujo real con Playwright local (`next start` en :3200 y :3206 con Explorer simulado) en gl y es. SPEC-057 (CA-3 enmendado) y SPEC-082 siguen en verde en la suite e2e.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-083/. Informe HTML opcional: _qa/SPEC-083/informe.html -->
| CA | Captura (`_qa/SPEC-083/`) |
|---|---|
| CA-1 | `ca1-gl-panel-ligas.png`, `ca1-es-panel-ligas.png` |
| CA-1, CA-2 | `ca2-{gl,es}-competicion-liga-f.png`, `ca2-{gl,es}-competicion-primera-division.png` |
| CA-2 | `ca2-gl-directos.png`, `ca2-es-directos.png` |
| CA-4 | `ca4-{gl,es}-{1440,360}-feminino.png`, `ca4-{gl,es}-{1440,360}-feminino-recarga.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-083-1, F-SPEC-083-2… con destino (spec futura o EPIC-MEJORA). -->
- CA-7 lo cumplió el orquestador (commit 4334fd6) con autorización expresa del titular; la verificación de SPEC-059/062 queda fuera de esta spec.
- Desviación menor: `XornadaFilters` aplica también la preferencia de ligas (guardada al montar y la del evento) sobre las secciones antes de decidir el vacío, para no depender del orden de efectos con `LeaguesPreferencesTrigger`; idempotente con lo que ya hace el diálogo.
- `DirectosView` conserva `var(--marca)` como fallback para una competición sin token de liga.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Implementador (2026-11-11): CA-1..CA-6 y CA-8 implementados con test en la rama `ft/SPEC-083-mantenimiento-ligas-y-artefactos` (sale de la de PR #135, sin mergear). Commits: 784bcb9 (CA-6), b2fc0a4 (CA-1..3), f9a7151 (CA-4), 5b6c800 + e408f9e (CA-5), 567d9d1 (versión 0.10.1; reajustar si al rebasar sobre main cambia). CA-7 hecho por el orquestador (4334fd6). Spec en `en-revision`; toca verificación.
