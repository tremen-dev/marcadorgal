---
id: ADR-001
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-20, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-001: Stack

- Deciders: sdd-arquitecto propone; Alberto Fojo aprueba (2026-09-20).
- Specs relacionadas: todas las de EPIC-001.

## Contexto

Proyecto personal con presupuesto bajo, una sola persona operando, pico de
carga concentrado en fin de semana y despliegue en Vercel decidido de partida.
La versión previa (tremen-dev/marcador.gal) validó Next.js + zod + SQL crudo y
sufrió por no tener CI.

## Decisión

- **Node 24 LTS**, npm, TypeScript estricto.
- **Next.js 16 App Router**, React 19, Turbopack. Un solo proyecto para web,
  API, tick de ingesta, webhooks y panel de operador.
- **zod 4** como única definición del modelo; los tipos se infieren.
- **Supabase**: Postgres, Realtime, Auth, Storage. Migraciones en SQL plano con
  la CLI de Supabase (`supabase/migrations/`). Dos proyectos: dev (Free) y prod
  (Pro).
- **`postgres.js`** para consultas de servidor, sin ORM. **`@supabase/supabase-js`**
  solo en cliente (Realtime, Auth).
- Instantes como cadena ISO-8601 UTC en el modelo, `timestamptz` en columnas.
- **CSS Modules + variables CSS** generadas desde `src/design/tokens.ts`.
  Sin Tailwind. Geist y Geist Mono autoalojadas.
- **Vitest** (unidad e integración), **Playwright** (pantalla real),
  **Biome** (lint y formato), **GitHub Actions** en cada PR ejecutando
  `npm run gates` (typecheck + lint + test + build).
- **Vercel Pro**, un proyecto, dominio marcador.gal, previews por PR.

## Consecuencias

### Positivas
Una base de código, un runtime, un lenguaje. Triggers, RLS y cron viven en SQL
donde se ejecutan. Sin magia de ORM que oculte el coste de una consulta.

### Negativas / follow-ups
Sin ORM, las consultas se tipan a mano contra los esquemas zod; si crecen
mucho, se reconsidera Drizzle en un ADR. Vercel Pro y Supabase Pro suman
45 $/mes antes del primer euro de ingreso.

## Alternativas consideradas

- **Drizzle ORM**: duplica en un DSL lo que triggers y cron ya exigen en SQL.
- **Tailwind**: el sistema de diseño fija píxeles y roles tipográficos, no
  utilidades; las variables CSS lo expresan sin capa intermedia.
- **oxlint + ESLint**: Biome cubre lint y formato con una herramienta.
- **SvelteKit / Remix**: sin ventaja sobre Next.js dado el despliegue en Vercel.
- **pnpm / bun**: no están instalados en la máquina de desarrollo; npm basta.
