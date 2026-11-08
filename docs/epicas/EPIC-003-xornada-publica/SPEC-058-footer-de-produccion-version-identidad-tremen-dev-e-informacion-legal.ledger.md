# Ledger de SPEC-058

Criterios de aceptación y evidencia de verificación de SPEC-058.

## CA-1 Componente Footer y maquetación responsive
- Evidencia: `src/components/layout/Footer.tsx` y `Footer.module.css`.
- Integrado en `src/app/(gl)/layout.tsx` y `src/app/(es)/es/layout.tsx`.
- Respeta tokens de diseño (`--bg`, `--line`, `--fg`, `--fg-muted`, `--fg-dim`, `--marca`), no utiliza valores hexadecimales crudos ni shorthand `font:`.
- `src/design/no-hex.test.ts` (3 tests) en verde.
- `src/design/css.test.ts` (5 tests) y `fonts.test.ts` (10 tests) en verde.
- Sticky footer en flex layout (`body { min-height: 100dvh; display: flex; flex-direction: column; }` y `.page { flex: 1 0 auto; width: 100%; }`): en escritorio permanece visible en el viewport sin forzar scroll cuando hay espacio debajo de las tablas.

## CA-2 Identidad y lockup de `{tremen.dev}`
- Evidencia: `src/components/layout/Footer.test.ts` en verde.
- Lockup `<span class="lockup"><span class="br">{</span>tremen<span class="dev">.dev</span><span class="br">}</span>` enlazando a `https://tremen.dev` con `target="_blank"` y `rel="noopener noreferrer"`.
- Acompañamiento localizado: «Un proxecto de» en galego y «Un proyecto de» en castellano.

## CA-3 Gestión de Versión de la Aplicación
- Evidencia: `src/lib/version.ts` y `src/lib/version.test.ts` (1 test) en verde.
- Exporta `APP_VERSION` leyendo directamente de `package.json` (`0.1.0`).
- Función `getAppVersionDisplay()` formatea `v0.1.0` (y soporta hash de commit opcional si existe en entorno de build).

## CA-4 Buzón de contacto con protección anti-spam
- Evidencia: `src/components/common/MailboxLink.tsx` y `MailboxLink.test.ts` en verde.
- Ofuscación en render estático/SSR (`ola [en] tremen.dev`) que previene recolección automática por scrapers de correo.
- Renderizado interactivo accesible con enlace directo para usuarios reales.

## CA-5 Páginas legales estáticas e i18n bilingüe
- Evidencia:
  - Módulo puro `src/lib/legal/content.ts` y `content.test.ts` (4 tests) en verde.
  - Vistas estáticas en Next.js App Router prerenderizadas (○ Static):
    - `/aviso-legal`, `/privacidade`, `/cookies` (Galego).
    - `/es/aviso-legal`, `/es/privacidad`, `/es/cookies` (Castellano).
  - Paridad estricta de diccionarios i18n verificada por `src/i18n/i18n.test.ts` (21 tests) en verde.
  - Documentos basados en las fuentes canónicas de `tremen.dev` (`stockeiro`, `marcador.gal` y `docs/paginas/todo-o-futbol-galego.html`), declarando ausencia de cookies de rastreo y uso de `localStorage` para preferencias.

## CA-6 Calidad y verificación automática
- `npm run typecheck` (tsc --noEmit) → 0 errores.
- `npm run lint` (biome check .) → 0 errores.
- `npm test` (vitest run: 140 suites, 2234 tests) → 100% passed.
- `npm run build` (next build Turbopack: 9 páginas estáticas prerenderizadas) → 0 errores.
- `npm run e2e` (Playwright: 250 tests passed, 1 skipped) → 100% passed.
- CI en GitHub Actions verificado en verde: [Run 42417114890](https://github.com/tremen-dev/marcadorgal/actions/runs/42417114890) (jobs `gates` y `e2e` en verde).
