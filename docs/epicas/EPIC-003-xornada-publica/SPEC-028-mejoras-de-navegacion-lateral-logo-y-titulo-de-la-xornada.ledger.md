---
id: SPEC-028
tipo: ledger
epica: EPIC-003
---
# Ledger — SPEC-028 Mejoras de navegación: lateral, logo y título de la xornada

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-028-mejoras-de-navegacion-lateral-logo-y-titulo-de-la-xornada`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/components/xornada/CompetitionNav.tsx` (enlace `data-competition-link`, sin aria-expanded/controls ni ▾▸), `src/components/xornada/XornadaFilters.tsx` (`goTo`: abre, `scrollIntoView` smooth/instant según `prefers-reduced-motion`, foco en `<summary>`, sin tocar URL), `src/components/xornada/Xornada.module.css` (`.competition` `scroll-margin-top: var(--space-16)`) | `e2e/xornada-nav.spec.ts` «CA-1 at 1024/1440px: the entry opens, scrolls and focuses; the URL stays» y «…reduced motion the jump is instant» (gl, es) | e2e verde; recorrido propio demo y `/` (base local) gl/es a 1024×300 y 1440×400 con `#f=finished`, activación por teclado (Enter): `open`, foco en `<summary>` (`:focus-visible`, contorno sólido), `elementFromPoint` dentro, URL y `history.length` idénticos; reducido: salto en el mismo tick (`[2412,2412,2412]`), sin preferencia: suave (`[0,0,2412]`). `verif-sidebar-*` | ✅ |
| CA-2 | `src/components/xornada/CompetitionNav.tsx` (`<a href="#xornada-<id>">`); `src/xornada/filter.ts` sin cambios (ya ignoraba la clave) | `src/xornada/filter.test.ts` «SPEC-028 CA-2 parseFragment ignores #xornada-<id>»; `e2e/xornada-nav.spec.ts` «CA-2 … without JavaScript: the entry is an anchor» y «CA-2 with JavaScript: a #xornada-<id> fragment is not filter state» | unit + e2e verde; `#xornada-<id>` al cargar → Todos, sin día, todas las filas, sin errores | ✅ |
| CA-3 | `src/components/xornada/Xornada.module.css` (`.sidebar` sticky, `max-height: 100dvh`, `overflow-y: auto`; divisor en `.sidebar + .main`), `src/components/xornada/XornadaFilters.tsx` (`apply`: `<li>` de la entrada `hidden` con su sección) | `e2e/xornada-nav.spec.ts` «CA-3 at 1024/1440px: the sidebar is sticky and goes with its sections» (gl, es) | e2e a 1024/1440 con viewport 200 px verde; propio: `sbTop` 0 tras saltar a la última con 300/400 px de alto; entrada oculta con su sección (`hiddenEntries` 1 en demo, 3 en `/` con `#f=finished`) | ✅ |
| CA-4 | `src/components/xornada/XornadaHeader.tsx` (logo `<a href="/"|"/es">`, `aria-label` `xornada.home`), `src/components/xornada/Xornada.module.css` (`.logo` sin subrayado), `src/i18n/gl.ts`, `src/i18n/es.ts` | `e2e/xornada-nav.spec.ts` «CA-4 and CA-6 at 360/390/1024/1440px» y «CA-4 at …px: from a filtered, folded, scrolled demo»; `e2e/xornada-nav.db.spec.ts` «CA-4 with/without JS: from /#d=…&f=finished, folded and scrolled, the logo resets» y «… a past week … the logo goes to /» | e2e:db con y sin JS verde; propio `/` y `/es` a 390/1440 con y sin JS desde `#d=…&f=finished` con 2 plegadas → `{path:/, hash:"", y:0, closed:0, day:0, all:true, hidden:0}`; desde `/xornada/2026-10-03` → `/`, `''`, 0. Nombre accesible ver F-SPEC-028-3; test demo «scrolled» hueco (V-2) | ✅ |
| CA-5 | `src/xornada/range.ts` (`xornadaSpan`, puro), `src/components/xornada/labels.ts` (`xornadaRange(days, locale)`), plantillas `xornada.range*` en `src/i18n/`. Ver F-SPEC-028-1 | `src/components/xornada/range-label.test.ts` «SPEC-028 CA-5 xornadaRange» (tabla gl/es: mismo mes, dos meses, un día, cambio de hora 2026-10-25, cambio de año; vacío → null; U+2013); `src/xornada/range.test.ts` | unit verde (mismo mes, dos meses, un día, cambio de hora, cambio de año, vacío, U+2013, sin cero). Funcionalmente cumple; la letra pide `xornadaRange` en `src/xornada/` y vive en `src/components/xornada/labels.ts` (F-SPEC-028-1, decide titular) | ⚠️ |
| CA-6 | `src/components/xornada/XornadaHeader.tsx` (`<h1>` visible), `src/components/xornada/XornadaBody.tsx` (cabecera dentro del cuerpo para que el repintado de SPEC-024 la siga), `src/components/xornada/labels.ts` (`xornadaHeading`), `src/components/xornada/XornadaScreen.tsx`, `src/components/xornada/Xornada.module.css` (`.title`, `.titleText`, `.titleSpace`) | `src/components/xornada/range-label.test.ts` «SPEC-028 CA-6 xornadaHeading»; `e2e/xornada-nav.spec.ts` «CA-4 and CA-6 at …px» y «CA-6 without JavaScript»; `e2e/xornada-live.spec.ts` «SPEC-028 CA-6: the title follows the repainted days»; `e2e/xornada-nav.db.spec.ts` «CA-6/CA-7 at …px: the week title is whole» | propio: `<h1>` único visible «Xornada · 2–5 out»/«Jornada · 2–5 oct» (demo), «… 12 set – 12 out» (`/`, igual que la tira), semana pasada «2–5 out»; escritorio: cabecera 56 px, x 183 = logo 155 + 28; móvil: fila 92–134 entre tira (52–92) y filtros (134–176), con y sin JS; aguanta `html{font-size:200%}`; repintado SPEC-024 en `xornada-live` verde. Coincide con `Escritorio.tpl.html`/`Movil.tpl.html` | ✅ |
| CA-7 | — | `e2e/xornada-nav.spec.ts` y `e2e/xornada-nav.db.spec.ts` a 360/390/1024/1440, con y sin JS (truncado, scroll horizontal, posiciones 56/42 px y 28 px); `src/design/*.test.ts` (tokens, sin hex, sin `font:`) y `src/i18n/i18n.test.ts` (paridad) en verde | matriz e2e verde; propio sin scroll horizontal a 390/1440 gl/es con y sin JS; diff CSS sin hex ni `font:`; tests de `src/design/` e i18n verdes | ✅ |
| CA-8 | `e2e/xornada-controls.spec.ts` (SPEC-023 CA-9 a la nueva letra), `e2e/xornada-live.spec.ts`, `e2e/xornada-weeks.db.spec.ts`, `e2e/xornada-realtime.db.spec.ts` (pliegan desde la cabecera) | `npm run gates` (87 ficheros, 1489 tests, build OK), `npm run e2e` 136 passed, `npm run e2e:db` 47 passed + 1 skipped (captura SPEC-020 sin QA_CAPTURE_DIR), `npm run test:db` 189 passed; `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío | gates 87 ficheros/1489 tests + build OK; e2e 136 passed; e2e:db 47 passed, 1 skipped; test:db 189 passed; diff de fronteras contra `origin/main` vacío; e2e enmendados revisados: no se debilitan (pliegan desde la cabecera y añaden «el lateral no pliega» y URL intacta) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN condicionado — 2026-10-10.** CA-1..CA-4 y CA-6..CA-8 ✅; CA-5 ⚠️ por F-SPEC-028-1 (desviación de letra: funcionalmente cumple). Spec queda en `en-revision` hasta que el titular acepte F-SPEC-028-1 (o el arquitecto enmiende CA-5).
- V-1 (baja, a11y, F-SPEC-028-2): orden DOM logo → `<h1>` → gl·es → tira; visual en móvil logo → gl·es → tira → título. No afecta al foco (el `<h1>` no es enfocable) ni al sentido; aguanta zoom de texto porque las barras tienen alto por token. Aceptable; frágil solo si una barra deja de tener alto fijo.
- V-2 (baja, higiene de test): `e2e/xornada-nav.spec.ts` «CA-4 … from a filtered, folded, scrolled demo» hace `scrollTo(0,200)` y luego `scrollTo(0,0)` antes del clic: la parte «scrolled» no se ejerce. Lo cubre `xornada-nav.db.spec.ts` (rueda, `scrollY > 0`) y el recorrido propio sin JS (`y` 400 → 0).
- V-3 (info, F-SPEC-028-3): nombre accesible «marcador.gal, xornada actual» empieza por el texto visible salvo el glifo decorativo ▮ → «.»; cumple WCAG 2.5.3 en la práctica.
- V-4 (info, H-7): con el seed de e2e:db la portada dice «12 set – 12 out» porque la tira empieza el 12 set; es el efecto aceptado en H-7.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-028/. Informe HTML opcional: _qa/SPEC-028/informe.html -->
| CA | Captura (`_qa/SPEC-028/`) |
|---|---|
| CA-6 (opción A) demo | `titulo-{gl,es}-{360,390,1024,1440}.png` |
| CA-6 semana pasada (e2e:db) | `semana-titulo-{gl,es}-{360,390,1024,1440}.png` |
| Verificador: pantallas demo y `/` 390/1440 gl/es con y sin JS | `verif-{demo,home}-{gl,es}-{390,1440}-{js,nojs}.png` |
| Verificador: CA-1/CA-3 viewport bajo | `verif-sidebar-{demo,home}-{gl,es}-{1024x300,1440x400}.png` |
| Verificador: CA-4 tras el logo y semana pasada | `verif-logo-after-home-{gl,es}-{390,1440}-{js,nojs}.png`, `verif-semana-pasada-home-{gl,es}-{390,1440}-{js,nojs}.png` |
| CA-1/CA-3 lateral tras el salto | `lateral-{gl,es}-{1024,1440}.png` (con `#f=finished`), `lateral-abajo-{gl,es}-{1024,1440}.png` (página desplazada, lateral sticky) |

Regenerar: `QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-028 DATABASE_URL_PUBLIC="" npx playwright test e2e/xornada-nav.spec.ts` y `QA_CAPTURE_DIR=… npx playwright test --config playwright.db.config.ts e2e/xornada-nav.db.spec.ts`. El lateral no existe en móvil (SPEC-023 CA-7): a 360/390 solo hay capturas del título.

## Salvedades / follow-ups
<!-- IDs F-SPEC-028-1, F-SPEC-028-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-028-1 (desviación de letra, CA-5).** CA-5 pide que `src/xornada/` exporte `xornadaRange(days, locale)` con `month.*`, pero la frontera de SPEC-019 CA-2 (`src/arch/xornada-boundary.ts`, en test) prohíbe `@/i18n` en `src/xornada/`. Se partió: `xornadaSpan(days)` puro en `src/xornada/range.ts` y `xornadaRange(days, locale)` en `src/components/xornada/labels.ts` (junto a `dayLabel`, que ya resuelve `month.*`). Destino: sdd-arquitecto (aceptar o enmendar la letra de CA-5).
- **F-SPEC-028-2 (nota de maquetación, CA-6 móvil).** El `<h1>` vive en la cabecera (el cliente de SPEC-024 lo repinta con los días) y en móvil se coloca bajo la tira con `position: absolute` sobre un hueco de 42 px reservado (`.controls .filters` `margin-top`, o `.titleSpace` sin tira). Funciona porque cabecera y tira tienen alto fijo por token; el orden DOM/lectura es logo → título → gl·es → tira. Si alguna barra deja de tener alto fijo, hay que revisarlo.
- **F-SPEC-028-3 (nota a11y, CA-4).** El nombre accesible del logo es `xornada.home` («marcador.gal, xornada actual»), distinto del texto visible «marcador▮gal»; empieza por el nombre visible, pero conviene que el verificador lo mire con lector.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho: CA-1..CA-8 implementados con test en la rama `ft/SPEC-028-mejoras-de-navegacion-lateral-logo-y-titulo-de-la-xornada` (commits `feat(SPEC-028)`/`test(SPEC-028)`), spec en `en-revision`. Sin push ni PR.
- Falta: verificación (sdd-verificador) y decisión sobre F-SPEC-028-1.
- Comandos: `DATABASE_URL_PUBLIC="" npm run gates`, `DATABASE_URL_PUBLIC="" npm run e2e`, `npm run e2e:db` y `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` (Supabase local arrancado).
