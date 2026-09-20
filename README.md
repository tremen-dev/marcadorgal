# marcador.gal

**Todo o fútbol galego nunha pantalla.**

Resultados en directo de las cinco divisiones españolas con equipos gallegos
(Primera, Segunda, Primera RFEF G1, Segunda RFEF G1, Tercera RFEF G1), jornada
completa, en una sola pantalla y en galego. Proyecto de [tremen.dev](https://tremen.dev).

Sucede a una versión previa ([tremen-dev/marcador.gal](https://github.com/tremen-dev/marcador.gal))
que no llegó a publicarse; de ella hereda el sistema de diseño y el modelo de
datos. Inspiración de marcadorgalego.gal, no sucesión.

## Estado

**SPEC-001 entregada:** Next.js 16 con App Router, página de espera bilingüe (galego/español) en `src/app/` (App Router), CI configurado (GitHub Actions con jobs gates y e2e), tests unitarios con Vitest y e2e con Playwright (chromium).

**SPEC-002 entregada:** modelo zod en `src/model/` (vocabulario de estados, cualificadores, reglas y alertas), migraciones base en `supabase/migrations/` (ocho tablas: competitions, teams, team_aliases, matches, observations, decisions, alerts, ingest_attempts; vista `board` de solo lectura; RLS en todas las tablas; extensiones pg_cron y pg_net para ingesta), test de arquitectura que prohíbe a `src/sources/**` importar fuera de `src/model` (corre en `npm run gates`), y tests de integración contra la base (`npm run test:db`).

**SPEC-003 entregada:** tokens de diseño tipados en `src/design/tokens.ts` (colores, tipografía, escalas, espaciado, medidas y variables semánticas de estado), CSS generado (`npm run tokens:css`) con test de paridad contra `docs/diseno/_tokens.css`, i18n tipada en `src/i18n/` (diccionarios de galego y español con tipos de `dominio.md`), reglas sin hex sueltos en componentes y sin shorthand `font:` en CSS de `src/` (para preservar `font-variant-numeric: tabular-nums` en números).
```bash
npm ci
npm run dev          # Servidor en http://localhost:3000
npm run gates        # Typecheck, lint, test y build (tsc, Biome, Vitest, next build)
npm run tokens:css   # Regenera src/design/tokens.css desde tokens.ts
npm run db:push      # Aplica migraciones sobre la base de `DATABASE_URL`
npm run test:db      # Tests de integración (requiere `.env` con `DATABASE_URL`)
npx playwright install chromium && npm run e2e  # Tests e2e (Playwright)
```

## Cómo se trabaja aquí

Estándar **tremen-sdd**: nada se implementa sin una SPEC aprobada por un humano;
las decisiones técnicas se registran como ADR; la evidencia de verificación vive
en el ledger de cada spec. Empieza por `FOUNDATION.md`.

| Fichero | Contenido |
|---|---|
| `FOUNDATION.md` | Constitución: decisiones locked D-1..D-10, alcance, no-negociables |
| `CLAUDE.md` | Reglas de la casa para agentes y personas |
| `docs/fundacion/contexto.md` | Contexto maestro: dónde estamos y por qué |
| `docs/fundacion/vision.md` | Problema, público, promesa, métricas norte |
| `docs/fundacion/dominio.md` | Glosario canónico |
| `docs/fundacion/reglas.md` | Reglas de negocio RN-01..RN-11 |
| `docs/epicas/` | Épicas, specs y ledgers (evidencia de verificación) |
| `docs/adr/` | Decisiones técnicas |
| `docs/diseno/` | Sistema de diseño (vinculante) |
| `docs/roadmap.md` | Secuencia de épicas |
| `docs/tablero.md` | Estado agregado (generado, no editar) |

## Stack

Next.js 16 · React 19 · TypeScript · zod · Supabase (Postgres, Realtime, Auth,
Storage) · Vercel. Detalle en `docs/adr/ADR-001-stack.md` y `ADR-002`.
