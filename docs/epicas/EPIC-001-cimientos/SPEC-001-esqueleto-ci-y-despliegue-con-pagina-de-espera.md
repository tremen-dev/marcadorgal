---
id: SPEC-001
tipo: spec
epica: EPIC-001
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-20, por: Alberto Fojo}
---
# SPEC-001 — Esqueleto, CI y despliegue con página de espera

## Problema
No hay código ni cauce: nada va de `git push` a marcador.gal. La versión previa
construyó motor y pantalla sin CI y nunca desplegó (EPIC-001, contexto.md). Esta
spec abre el cauce completo con el mínimo contenido: un esqueleto Next.js con
las convenciones de ADR-001, `npm run gates` en GitHub Actions, y una página de
espera en galego y castellano (D-2), `noindex`, servida desde Vercel con el
sistema de diseño (D-8, ADR-005) y sin cookies ni terceros (no-negociables).
Cubre los criterios de éxito 1 y 2 de EPIC-001.

## Usuarios / roles afectados
- sdd-implementador y sdd-verificador: heredan el esqueleto, los scripts y la CI.
- Titular del proyecto (humano): ejecuta los actos H-1..H-4 en Vercel, Dinahosting y GitHub.
- Público: solo ve la página de espera; ningún dato suyo se recoge.

## Criterios de aceptación
- **CA-1 Gates.** Dado un clon limpio con Node 24 (`.nvmrc`), cuando `npm ci && npm run gates`, entonces sale 0 y encadena `typecheck` (`tsc --noEmit`), `lint` (`biome check .`), `test` (`vitest run`) y `build` (`next build`), en ese orden. `tsconfig.json` tiene `strict: true`; `package.json` tiene `engines.node` `24.x`, `next` ≥16, `react` ≥19. Verif.: comando + `npx tsc --showConfig`.
- **CA-2 Test unitario.** `src/i18n/i18n.test.ts` comprueba que `gl.ts` y `es.ts` exportan el mismo conjunto de claves y ninguna vacía. `npm test` pasa; al borrar una clave de `es.ts`, falla. Verif.: comando + mutación manual.
- **CA-3 i18n.** Dado `src/i18n/{gl,es,index}.ts` (`Locale = 'gl' | 'es'`, `t(locale)`), cuando se renderiza `/` o `/es`, entonces el `h1` y el párrafo coinciden literalmente con las cadenas de `gl.ts` / `es.ts`. Ningún texto visible vive en `.tsx`. Verif.: Playwright compara con los valores importados de los ficheros i18n.
- **CA-4 Rutas e idioma.** GET `/` → 200 con `<html lang="gl">`; GET `/es` → 200 con `<html lang="es">`; GET `/gl` → 404. El enlace de cambio de idioma lleva de `/` a `/es` y de `/es` a `/`. Verif.: Playwright.
- **CA-5 noindex.** Ambas rutas incluyen `<meta name="robots" content="noindex, nofollow">`. Verif.: Playwright.
- **CA-6 Marca y tokens.** La página muestra el logotipo tipográfico `marcador▮gal` (▮ con `color: var(--marca)` = `rgb(86, 219, 143)`, peso 800, `font-synthesis: none`), fondo del `body` `rgb(17, 17, 16)`, texto `rgb(245, 241, 234)`, `font-family` que empieza por `Geist`, y `document.fonts.check('800 1em Geist') === true`. Verif.: Playwright (estilos computados).
- **CA-7 Sin hex sueltos.** `grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.tsx' --include='*.ts' --include='*.module.css'` no devuelve nada: los valores hex viven solo en el bloque `:root` de `src/app/globals.css`, con los mismos nombres y valores que `docs/diseno/_tokens.css`. Verif.: comando + diff manual contra `_tokens.css`.
- **CA-8 Sin terceros ni cookies.** Al cargar `/` y `/es`, todas las peticiones de red son al mismo origen (ninguna a `fonts.googleapis.com` ni a nadie), `context.cookies()` está vacío y cada `/fonts/*.woff2` referenciado responde 200. Verif.: Playwright (`page.on('request')`).
- **CA-9 Móvil y táctil.** A 360×640 y a 1440×900, `document.documentElement.scrollWidth <= clientWidth`; el enlace de idioma mide ≥ 44 px de alto y tiene foco visible (`outline` no `none`). Verif.: Playwright.
- **CA-10 E2E local.** `npm run e2e` ejecuta `e2e/waiting.spec.ts` (CA-3..CA-9) con Playwright, solo Chromium, contra `next build && next start` (nunca `next dev`), y pasa en local. Verif.: comando.
- **CA-11 CI.** `.github/workflows/ci.yml` se dispara en `pull_request` y en `push` a `main`; job `gates` = `actions/setup-node` con `node-version-file: .nvmrc` + caché npm + `npm ci` + `npm run gates`; job `e2e` = lo mismo + `npx playwright install --with-deps chromium` + `npm run e2e`. En la PR de esta spec ambos checks están en verde. Verif.: `gh pr checks`.
- **CA-12 Entorno.** `.env.example` existe con estas claves y sin valores: `API_FOOTBALL_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_TICK_TOKEN`. `git check-ignore -q .env` sale 0 y `git check-ignore -q .env.example` sale 1. Ningún fichero del repo contiene un valor de `.env`. Verif.: comando + `git grep`.
- **CA-13 Producción (humano + comando).** Tras H-1..H-3 y un push a `main`, `curl -s -o /dev/null -w '%{http_code}' https://marcador.gal` y `.../es` devuelven 200; el HTML de cada una lleva su `lang` y la meta `noindex`; `https://www.marcador.gal` redirige (307/308) al apex. Verif.: `curl`.
- **CA-14 Previews (humano + comando).** La PR de esta spec recibe del bot de Vercel una URL de preview que responde 200 en `/` y `/es`. Verif.: `gh pr view --comments` + `curl`.

## Entidades y reglas afectadas
Ninguna entidad del dominio ni RN del motor: la página no muestra datos. Aplican
D-1 (marca propia), D-2 (galego por defecto, `/es`, todo texto vía i18n), D-8 y
ADR-005 (tokens, Geist autoalojada, solo oscuro, 44 px, foco visible), D-10, el
no-negociable «sin cookies, sin analítica, sin datos de quien mira» y ADR-001
(stack y `npm run gates`). Vercel y previews: ADR-001; ADR-002 no interviene aún.

## Fuera de alcance
Modelo zod, `src/model`, `src/sources`, test de arquitectura, migraciones y
proyectos Supabase (specs b), `src/design/tokens.ts`, generador de CSS y test de
paridad (spec c), calendario (spec d), i18n más allá de dos cadenas por idioma,
detección automática de idioma o middleware, `robots.txt`/sitemap, pantalla
Xornada, Vercel Cron, variables de entorno en Vercel (esta spec no necesita
ninguna), modo claro, analítica (nunca). El README pasa a describir el esqueleto
al cerrar la spec (sdd-documentalista).

## Notas para el gate humano
Decisiones tomadas aquí (ninguna exige ADR: no constriñen datos ni fronteras):
- **N-1 Rutas.** Dos root layouts por route groups: `src/app/(gl)/{layout,page}.tsx`
  para `/` y `src/app/(es)/es/{layout,page}.tsx` para `/es`, cada uno con su
  `<html lang>`; UI compartida en `src/components/`. Evita `[locale]` + rewrites
  y no expone `/gl`. Revisable en la spec de Xornada sin ADR.
- **N-2 Playwright en CI**, como job `e2e` separado y no dentro de `gates`
  (`gates` sigue siendo typecheck+lint+test+build, como en CLAUDE.md). Coste
  ~2 min por PR; a cambio la página real se verifica desde el primer día y el
  verificador hereda el arnés. Si el job resulta inestable, se degrada a manual
  con follow-up, no al revés.
- **N-3 Tokens mínimos.** Sin `tokens.ts` todavía: `globals.css` transcribe en
  `:root` solo `--bg`, `--fg`, `--fg-muted`, `--marca`, `--line`, `--sans`,
  `--mono`, con comentario «lo sustituye la spec de tokens». Fuentes: las cinco
  caras de `public/fonts/` de la versión previa más `Geist-ExtraBold.woff2` del
  release oficial (misma licencia OFL; `LICENSE.txt` ya incluido), porque el
  logotipo va a peso 800 (Marca.dc.html) y no se sintetiza negrita.
- **N-4 noindex** por `metadata.robots` de Next, no por cabecera HTTP; lo retira
  la spec de Xornada.
- **N-5 Node** fijado en `.nvmrc`, `engines.node` y `setup-node`; Vercel toma la
  versión de `engines`.

Actos del humano (precondiciones de CA-13/CA-14; no son código):
- **H-1** Crear el proyecto en Vercel Pro (equipo de tremen.dev), importar
  `tremen-dev/marcadorgal`, framework Next.js, rama de producción `main`,
  previews por PR con comentarios del bot activados. Sin variables de entorno.
- **H-2** Añadir en Vercel los dominios `marcador.gal` (principal) y
  `www.marcador.gal` (redirección al apex).
- **H-3** En Dinahosting: registro A del apex a la IP que indique Vercel y CNAME
  `www` → `cname.vercel-dns.com`; esperar propagación y certificado.
- **H-4** (recomendado) Proteger `main` en GitHub: PR obligatoria con los checks
  `gates` y `e2e` en verde.

Mirar con lupa: N-1 (estructura de rutas que heredará Xornada), N-2 (coste de CI
frente a valor), los nombres de variables de CA-12 (los fijan para las specs
b y c) y que la spec no toca `.env` local.
