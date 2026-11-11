---
id: SPEC-083
tipo: ledger
epica: EPIC-MANT
---
# Ledger — SPEC-083 Mantenimiento de ligas y artefactos sdd

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-083-mantenimiento-ligas-y-artefactos`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/league-preferences.ts` (sin `featuredBadge`), `src/components/xornada/LeaguesPreferencesDialog.tsx`, `Xornada.module.css` (sin `.itemBadge`), `src/components/navigation/CompetitionNav.tsx` y `.module.css` (sin etiquetas ni `.featuredTeamTag`); b2fc0a4 | `src/lib/league-preferences.test.ts` «SPEC-083 CA-1 no item carries a featured team badge»; `src/components/navigation/CompetitionNav.test.ts` «SPEC-083 CA-1 no pill names a team»; `src/components/competition/CompetitionHeader.test.ts` «CA-1 the featured team is still shown»; `e2e/ligas-preferencias.spec.ts` «CA-3 switches named…» (gl/es: ningún switch contiene nombre ni shortName de `GALICIAN_CLUBS`) | | ❌ |
| CA-2 | `src/design/league-color.ts` (`leagueColor`), `src/model/competitions.ts` (sin `color`/`accentColor`), `src/model/clubs.ts` (sin `colors`), `CompetitionHeader.tsx`, `CompetitionNav.tsx`, `DirectosView.tsx` (fallback `var(--marca)` para id sin token); HERENCIA.md entrada CA-2; b2fc0a4 | `CompetitionNav.test.ts` «SPEC-083 CA-2 each dot is var(--liga-<id>)»; `CompetitionHeader.test.ts` «CA-2 the badge is var(--liga-<id>) for every competition»; `DirectosView.test.ts` «SPEC-083 CA-2 … each section's dot»; `src/model/competitions.test.ts` «SPEC-083 CA-2 the metadata carries no colour»; `src/model/clubs.test.ts` «SPEC-083 CA-2 no club carries colours» | | ❌ |
| CA-3 | `src/design/no-hex.test.ts` (patrón `rgb(`/`rgba(`/`hsl(`/`hsla(` en `src/**/*.{ts,tsx}` salvo `tokens.ts` y `*.test.ts(x)`); b2fc0a4 | `src/design/no-hex.test.ts` «SPEC-083 CA-3 …» (2 casos; antes de CA-2 fallaba con `competitions.ts` y `clubs.ts`) | | ❌ |
| CA-4 | `src/xornada/filter.ts` (`emptyReason`), `src/components/xornada/XornadaBody.tsx` (`data-empty-filter`/`data-empty-leagues`), `XornadaFilters.tsx` (aplica la preferencia guardada y la del evento antes de decidir el vacío), `src/i18n/gl.ts`/`es.ts` (`xornada.leaguesEmpty`); HERENCIA.md entrada CA-4; f9a7151 | `src/xornada/filter.test.ts` «SPEC-083 CA-4 emptyReason» (4 casos); `src/i18n/i18n.test.ts` «SPEC-083 CA-4 leaguesEmpty in gl and es»; `e2e/ligas-preferencias.spec.ts` «SPEC-083 CA-4 the empty state names the leagues» (gl y es: preset `Feminino`, recarga, `Todas` lo oculta, `#d=2026-10-02&f=live` con y sin recarga sigue `xornada.empty`) | | ❌ |
| CA-5 | `docs/diseno/Global.tpl.html` (comentario SPEC-082 en lugar de `gl·es`, sin `LANG_*`/`glStyle`/`setGl`), `Global.dc.html` regenerado con `node build.mjs` (solo cambia `Global.*`), HERENCIA.md entrada CA-5; 5b6c800 | `src/design/artboards.test.ts` «SPEC-083 CA-5 Global without gl·es» (4 casos) | | ❌ |
| CA-6 | Frontmatter `id`/`tipo: ledger`/`epica` en los ledgers de SPEC-050, 051, 057, 058, 059, 060 (EPIC-003) y 062 (EPIC-004); títulos de matriz y veredicto RED de 1ª y 2ª ronda de SPEC-057 con «(superada: ver 3ª ronda, GREEN)»; 784bcb9 | `node valida.mjs` → `[valida] OK` (antes 7 errores «sin frontmatter o sin 'id'») | | ❌ |
| CA-7 | Hecho por el orquestador con autorización expresa del titular en 4334fd6 (SPEC-059 `feito` → `en-revision`; SPEC-062 `implementada` → `bloqueada`, luego `aprobada` por el titular). El implementador no tocó sus estados | n-a (fuera del implementador) | | ❌ |
| CA-8 | Versión 0.10.0 → 0.10.1 (`npm version patch --no-git-tag-version`, 567d9d1); `git diff 4334fd6 -- src` sin `font:` ni hex añadidos | 2026-11-11, host Windows (autocrlf=false): `valida.mjs` → `[valida] OK`; `npm run gates` exit 0 (vitest 172 ficheros, 2890 passed / 3 skipped; biome 486 ficheros sin errores; build OK); `npx playwright test` exit 0 (433 passed, 1 skipped, 4.9 min) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-083/. Informe HTML opcional: _qa/SPEC-083/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-083-1, F-SPEC-083-2… con destino (spec futura o EPIC-MEJORA). -->
- CA-7 lo cumplió el orquestador (commit 4334fd6) con autorización expresa del titular; la verificación de SPEC-059/062 queda fuera de esta spec.
- Desviación menor: `XornadaFilters` aplica también la preferencia de ligas (guardada al montar y la del evento) sobre las secciones antes de decidir el vacío, para no depender del orden de efectos con `LeaguesPreferencesTrigger`; idempotente con lo que ya hace el diálogo.
- `DirectosView` conserva `var(--marca)` como fallback para una competición sin token de liga.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
Implementador (2026-11-11): CA-1..CA-6 y CA-8 implementados con test en la rama `ft/SPEC-083-mantenimiento-ligas-y-artefactos` (sale de la de PR #135, sin mergear). Commits: 784bcb9 (CA-6), b2fc0a4 (CA-1..3), f9a7151 (CA-4), 5b6c800 + e408f9e (CA-5), 567d9d1 (versión 0.10.1; reajustar si al rebasar sobre main cambia). CA-7 hecho por el orquestador (4334fd6). Spec en `en-revision`; toca verificación.
