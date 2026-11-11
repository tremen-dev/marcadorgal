# SPEC-057 — Panel de preferencias de ligas visibles e enlaces a clasificación en cabeceiras de columna

| Criterio | Módulos afectados | Pruebas | Estado |
| :--- | :--- | :--- | :--- |
| CA-1 Cabecera limpia en portada | `src/app/xornada-home.tsx` | Verificación visual y pruebas de navegación e2e | ✅ Completado |
| CA-2 Enlaces en cabeceras de columna | `src/components/xornada/CompetitionSection.tsx`, `Xornada.module.css` | Subheader con enlace contextual `Táboa ↗` / `Clasificación ↗` | ✅ Completado |
| CA-3 Panel de preferencias ⚙ | `src/components/xornada/LeaguesPreferencesDialog.tsx`, `XornadaControls.tsx`, `Xornada.module.css` | Diálogo accesible con interruptores por liga y presets rápidos | ✅ Completado |
| CA-4 Persistencia en localStorage | `src/lib/league-preferences.ts`, `src/lib/league-preferences.test.ts` | 5 pruebas unitarias de persistencia, fallback y eventos de DOM | ✅ Completado |
| CA-5 Resiliencia SSR e hidratación | `src/components/xornada/XornadaFilters.tsx` | Atributo `data-user-hidden` en cliente; render SSR completo sin JS | ✅ Completado |
| CA-6 Calidad y gates | Suite completa (`npm run gates`, `npx playwright test`) | Biome (0 errores), TypeScript (0 errores), Vitest (2225 pruebas), Playwright (250 pruebas) | ✅ Completado |

## Matriz del verificador (2026-11-11, código de main en 90bec70)
<!-- La tabla de arriba es la mitad del implementador (formato previo a la plantilla). Esta es la del verificador. -->
| CA | Test que lo demuestra | Verif. | Estado |
|---|---|---|---|
| CA-1 | ninguno automatizado | Prod `/` y `/es` (390 y 1440): sin `CompetitionNav`, la pantalla empieza por logo/lema y `Xornada · 6–16 nov`. Local: `CompetitionNav` presente en `/competicion`, `/clasificacion`, `/calendario` y `/directos` (200) | ⚠️ sin test |
| CA-2 | ninguno automatizado | Con `SHOW_TABLE_LINK=false` (defecto y prod: 0 enlaces en `curl https://marcador.gal/`) el enlace no existe. Con `true`: `Táboa ↗`/`Tabla ↗`, href `/competicion/<id>` y `/es/competicion/<id>`, `aria-label` con competición, Tab+Enter navega. Está fuera de `<summary>`: al plegar la columna desaparece | ❌ |
| CA-3 | ninguno automatizado | Disparador `leagues-preferences-trigger`, `role=dialog`, `aria-modal=true`, Escape y clic exterior cierran, 8 switches con `· Depor ABANCA`/`· As Celtas`, presets funcionan, última liga deshabilitada + aviso. Desvíos: etiquetas de preset (`Feminino`, `RFEF / Galegas`, `Profesional` ≠ `Só …`); en `/es` nombres en galego (`Primeira División`) y `aria-label="Atallos rápidos"` literal | ⚠️ |
| CA-4 | `src/lib/league-preferences.test.ts` (5 casos) | Clave `marcadorgal:preferences:visible-leagues:v1`; sin valor → todas; toggle oculta al instante; persiste tras recarga (gl y es) | ✅ |
| CA-5 | ninguno específico (e2e `xornada.spec.ts` CA-5 sin JS es de SPEC-021/023) | Sin JS: 5/5 secciones demo y 8 en prod. Hidratación con prefs guardadas: sin errores de consola. **localStorage bloqueado (getter lanza `SecurityError`): la portada entera cae a «This page couldn't load»**, local y prod; `/directos`, `/competicion`, `/aviso-legal` cargan bien | ❌ |
| CA-6 | gates + e2e | `tsc` 0; `biome check` 0 (473 ficheros); vitest 2807 ok/3 skip (168 ficheros, worktree LF); `npx playwright test` 352 ok/1 skip (incluye `next build`). Pero 8 colores de liga como `rgb()` literales en `src/lib/league-preferences.ts` fuera de tokens, y textos sin i18n (ver CA-3) | ❌ |

## Veredicto del verificador
**RED** — 2026-11-11, sdd-verificador. Gates y suite e2e verdes, pero CA-2, CA-5 y CA-6 no se cumplen y CA-1/CA-3 no tienen test.

Findings:
1. **F-SPEC-057-1 (CA-5, grave, en prod).** `src/lib/league-preferences.ts:91` y `:110` evalúan `!window.localStorage` fuera del `try`; si el navegador bloquea el almacenamiento, el getter lanza dentro del `useEffect` de `LeaguesPreferencesTrigger` y React tumba toda la portada. Reproducido en `https://marcador.gal/` (captura `CA-5-storage-bloqueado-prod.png`).
2. **F-SPEC-057-2 (CA-2).** El enlace está tras `SHOW_TABLE_LINK` (defecto `false`, commit 07c17a5) y en prod no se pinta; la spec no recoge el interruptor. Además vive en un subheader fuera de `<summary>` y se oculta con la columna plegada. Hace falta enmendar la spec (arquitecto) o encender el enlace.
3. **F-SPEC-057-3 (CA-6 tokens).** `KNOWN_COMPETITIONS[].colorRgb` son 8 `rgb(...)` inventados y pintados en línea; esquivan la guarda `no-hex` pero no son tokens de `src/design/tokens.ts` (D-8). El test unitario fija `rgb(` en vez de exigir tokens.
4. **F-SPEC-057-4 (CA-6 bilingüismo / CA-3).** En `/es` los switches muestran `defaultName` en galego (no usan `nameKey`) y la toolbar lleva `aria-label="Atallos rápidos"` sin i18n. Presets con etiquetas distintas a las de la spec.
5. **F-SPEC-057-5 (CA-1, CA-2, CA-3, CA-5).** Sin test automatizado (ni e2e ni unitario de componente) que los demuestre; solo CA-4 tiene tests.

## Evidencia visual
| CA | Captura (`_qa/SPEC-057/`) |
|---|---|
| CA-1 | `CA-1-prod-gl-mobile.png`, `CA-1-prod-gl-desktop.png`, `CA-1-prod-es-mobile.png`, `CA-1-prod-es-desktop.png` |
| CA-2 | `CA-2-enlace-gl.png`, `CA-2-enlace-es.png`, `CA-2-plegada-gl.png`, `CA-2-plegada-es.png` (servidor con `SHOW_TABLE_LINK=true`) |
| CA-3 | `CA-3-panel-gl.png`, `CA-3-panel-es.png`, `CA-3-al-menos-una-gl.png`, `CA-3-al-menos-una-es.png` |
| CA-4 | `CA-4-persistencia-gl.png`, `CA-4-persistencia-es.png` |
| CA-5 | `CA-5-sin-js.png`, `CA-5-storage-bloqueado-local.png`, `CA-5-storage-bloqueado-prod.png` |

## Implementador — cierre de findings (2026-11-11, rama `ft/SPEC-082-cabecera-movil-ligera`)
| CA | Implementado (fichero) | Test (fichero/caso) |
|---|---|---|
| CA-1 | sin cambios (`src/app/xornada-home.tsx`) | `e2e/ligas-preferencias.spec.ts` «CA-1 no CompetitionNav on the home…» y «CA-1 CompetitionNav stays on /directos and /competicion» (gl, es) |
| CA-2 | `src/components/xornada/CompetitionSection.tsx` (`aria-label` por `competitions.tableLinkLabel`), `playwright.config.ts` (`SHOW_TABLE_LINK: ""` en el servidor por defecto) | `src/components/xornada/columns.test.ts` «SPEC-057 CA-2 the table link: off by default, on per column» (gl, es; href, aria-label, fuera de `<summary>`); `e2e/ligas-preferencias.spec.ts` «CA-2 off by default…»; `src/app/config.test.ts` `SHOW_TABLE_LINK` |
| CA-3 | `src/components/xornada/LeaguesPreferencesDialog.tsx` (nombre por `nameKey`, toolbar `competitions.presetsLabel`), `src/i18n/gl.ts`, `src/i18n/es.ts` (`competitions.names.*`, `presetsLabel`), `src/lib/league-preferences.ts` (sin `defaultName`) | `src/lib/league-preferences.test.ts` «each nameKey resolves in gl and es…»; `e2e/ligas-preferencias.spec.ts` «CA-3 switches named in the page's language, presets and the last league» (gl, es) |
| CA-4 | sin cambios | `src/lib/league-preferences.test.ts` (casos previos) |
| CA-5 | `src/lib/league-preferences.ts` (acceso a `window.localStorage` dentro del `try` en lectura y escritura) | `src/lib/league-preferences.test.ts` «with localStorage blocked…», «with setItem throwing…»; `e2e/ligas-preferencias.spec.ts` «CA-5 without JavaScript…», «CA-5 with storage blocked…» (gl, es) |
| CA-6 | `src/design/tokens.ts` (`LEAGUE_COLORS`), `src/design/css.ts`, `src/design/tokens.css` (regenerado), `src/lib/league-preferences.ts` (`color: var(--liga-<id>)`), `docs/diseno/HERENCIA.md` | `src/lib/league-preferences.test.ts` «each league colour is a var() of a LEAGUE_COLORS token…», «the source of league-preferences has no literal colour»; `src/i18n/i18n.test.ts` (paridad) |

Evidencia:
- Rojo previo: `npx vitest run src/lib/league-preferences.test.ts` → 4 failed (entre ellos `SecurityError: blocked` lanzado por `getStoredVisibleCompetitions`). E2E «CA-5 with storage blocked» con el acceso de nuevo fuera del `try` → 2 failed (gl, es); restaurado → pasa.
- `npx playwright test e2e/ligas-preferencias.spec.ts` → 12 passed.
- `npm run gates` → exit 0; vitest 168 ficheros, 2814 passed / 3 skipped; `next build` ok.
- `npx playwright test` (suite completa) → 364 passed / 1 skipped.

Salvedades / follow-ups:
- F-SPEC-057-6: `src/model/competitions.ts` (`COMPETITIONS_METADATA[].color/accentColor`) sigue con `rgb()` literales; fuera del panel y de esta spec, no se pintan en el panel.
- La subida de versión de `package.json` queda para el PR conjunto con SPEC-082 (indicación del orquestador).

## Matriz del verificador — 2ª ronda (2026-11-11, rama `ft/SPEC-082-cabecera-movil-ligera` en e4c5c28, spec enmendada)
| CA | Test que lo demuestra | Verif. | Estado |
|---|---|---|---|
| CA-1 | `e2e/ligas-preferencias.spec.ts` «CA-1 no CompetitionNav…», «CA-1 CompetitionNav stays…» (gl, es) | e2e verde; aserta 0 `competition-nav` en portada y nada visible sobre el logo; nav presente en `/directos`, `/competicion`, `/clasificacion`, `/calendario` | ✅ |
| CA-2 | `columns.test.ts` «SPEC-057 CA-2…»; e2e «CA-2 off by default» | Apagado: 0 enlaces. Servidor local con `SHOW_TABLE_LINK=true`: 5 enlaces `/competicion/<id>` y `/es/competicion/<id>`, `Táboa ↗`/`Tabla ↗`, `aria-label` «Táboa de Primeira División», ninguno dentro de `<summary>`, foco + `Enter` navega (gl y es) | ✅ |
| CA-3 | e2e «CA-3 switches named…» (gl, es); `league-preferences.test.ts` nameKey | Panel con presets `Todas/Feminino/RFEF / Galegas/Profesional` (es: `Femenino/RFEF / Gallegas`), nombres en es por `nameKey`, toolbar con `aria-label` i18n, última liga bloqueada. **Pero los interruptores no muestran foco de teclado**: `.switchInput { outline: none }` anula el anillo global `:focus-visible`; con foco, `outlineStyle: none`, `boxShadow: none` (captura `CA-3-foco-switch-gl.png`) | ❌ |
| CA-4 | `league-preferences.test.ts` | Local: preset `Profesional` → clave `marcadorgal:preferences:visible-leagues:v1` = `["primera-division","segunda-division"]`, oculta al instante y persiste tras recarga (gl, es) | ✅ |
| CA-5 | `league-preferences.test.ts` «with localStorage blocked…», «with setItem throwing…»; e2e «CA-5 without JavaScript…», «CA-5 with storage blocked…» | Chrome local con getter de `localStorage` lanzando `SecurityError`: demo gl/es carga 5/5 secciones, preset `Profesional` funciona en memoria, 0 `pageerror`; `/` y `/es` cargan (logo visible, 0 errores). F-1 cerrado | ✅ |
| CA-6 | gates + e2e; tests de tokens e i18n | `tsc` 0; `biome check` 0 (474 ficheros, worktree LF); vitest 2814 ok/3 skip (168 ficheros); `npx playwright test` 364 ok/1 skip. Colores de liga ya son `var(--liga-<id>)` de `LEAGUE_COLORS`. **Pero el CSS del panel conserva 2 literales `rgba()`**: `Xornada.module.css:1156` (`.dialogOverlay` `background: rgba(0, 0, 0, 0.75)`) y `:1189` (`.dialogCard` `box-shadow: … rgba(0, 0, 0, 0.85)`); son los únicos `rgba(` de todo `src/**/*.css` fuera de tokens | ❌ |

## Veredicto del verificador — 2ª ronda
**RED** — 2026-11-11, sdd-verificador. F-1..F-5 cerrados (almacenamiento bloqueado verificado en local, nameKey, i18n, tests). Quedan dos incumplimientos nuevos/no detectados en la 1ª ronda.

Findings:
1. **F-SPEC-057-7 (CA-6 tokens).** `src/components/xornada/Xornada.module.css:1156` y `:1189` usan `rgba(0, 0, 0, …)` literales en el overlay y la sombra del panel; CA-6 prohíbe `rgb()` literales en estilos del panel. Deben salir de tokens de `src/design/tokens.ts` (p. ej. un token de velo/sombra) y conviene una guarda de test que lo cubra para el CSS del panel.
2. **F-SPEC-057-8 (CA-3 accesibilidad).** `.switchInput` (`Xornada.module.css`, bloque SPEC-057) declara `outline: none` sin `:focus-visible` propio: navegando con teclado por el diálogo, el interruptor enfocado no se distingue. Añadir un indicador de foco (o no anular el anillo global) y un caso e2e que lo compruebe.

Notas (no bloquean): `· Depor ABANCA` / `· As Celtas` son nombres propios fijados en `KNOWN_COMPETITIONS` (CA-3 los cita literales); F-SPEC-057-6 (`COMPETITIONS_METADATA` con `rgb()`) sigue fuera del panel. El `aria-label` del enlace usa `competition.name` (nombre canónico, igual en gl y es por dominio). La portada real no se probó con datos en local (sin lector, estado vacío); el panel se probó sobre `/demo/xornada` y `/es/demo/xornada`, mismo `XornadaBody`.

| CA | Capturas 2ª ronda (`_qa/SPEC-057/`) |
|---|---|
| CA-2 | `CA-2-enlace-r2-gl.png`, `CA-2-enlace-r2-es.png` |
| CA-3 | `CA-3-panel-r2-gl.png`, `CA-3-panel-r2-es.png`, `CA-3-foco-switch-gl.png`, `CA-3-foco-switch-es.png` |
| CA-4 | `CA-4-persistencia-r2-gl.png`, `CA-4-persistencia-r2-es.png` |
| CA-5 | `CA-5-storage-bloqueado-local-r2-gl.png`, `CA-5-storage-bloqueado-local-r2-es.png` |

## Cómo retomar (handoff)
Spec devuelta a `en-progreso`. Arreglar F-1 (mover la comprobación dentro del `try`) es urgente por estar en prod. F-2 requiere decisión del titular/arquitecto (¿se enmienda CA-2 con el interruptor?). Después, tests para CA-1/2/3/5 (incluido almacenamiento bloqueado) y nueva verificación.

Implementador (2026-11-11): F-1, F-3, F-4 y F-5 cerrados (tabla «Implementador — cierre de findings»); F-2 cerrado por la enmienda de la spec y cubierto por tests. Spec en `en-revision`; toca nueva verificación. Rama `ft/SPEC-082-cabecera-movil-ligera` (PR conjunto con SPEC-082).

Verificador (2026-11-11, 2ª ronda): RED por F-7 y F-8; spec a `en-progreso`.
