# marcador.gal

Proyecto gestionado con el estándar **tremen-sdd**. Antes de trabajar:

1. Lee `FOUNDATION.md` (constitución; decisiones locked D-1..D-10).
2. Lee `docs/fundacion/contexto.md` (contexto maestro del proyecto).
3. Todo trabajo entra por `/sdd-orquestador`; nada se codea sin SPEC aprobada.
4. El estado vive en el frontmatter de cada spec; el tablero (`docs/tablero.md`)
   es generado — regenéralo con `/sdd-tablero`, nunca lo edites.

Idioma de trabajo: español (docs/specs). Código e identificadores: inglés.
Texto visible al usuario: galego por defecto, castellano en `/es`, siempre vía
i18n. Los términos de dominio de `docs/fundacion/dominio.md` no se traducen.

## Reglas de la casa

- **Una página.** Un ADR, una spec o una épica caben en una página. Si no
  cabe, sobra prosa o hay que partirla. El ledger registra evidencia (comando,
  salida, captura), no narrativa.
- **Fronteras de módulo.** `src/sources/*` solo importa de `src/model`.
  `src/decide/` es puro: sin reloj, sin red, sin base de datos. Las fuentes no
  escriben en base de datos ni deciden nada.
- **Crudo antes que parseo.** Todo adaptador guarda la respuesta cruda antes de
  interpretarla. Los tests de fuentes corren contra fixtures del repo, nunca
  contra la red.
- **Tiempo.** Instantes como cadena ISO-8601 en UTC con `Z` en el modelo.
  Columnas `timestamptz`. Nunca `Date` en los esquemas.
- **Estados de partido.** Cinco y solo cinco: `scheduled`, `live`, `finished`,
  `postponed`, `suspended`. El descanso es un momento dentro de `live`.
- **Diseño.** `docs/diseno/` manda (D-8). Tokens en `src/design/tokens.ts`,
  nunca hex sueltos en componentes. Ningún estado se comunica solo con color.
- **Stack.** Next.js 16 App Router, React 19, TypeScript estricto, zod 4,
  Supabase (Postgres, Realtime, Auth, Storage), `postgres.js` sin ORM,
  migraciones SQL con la CLI de Supabase, Vitest, Playwright, Biome, npm.
  Detalle en `docs/adr/ADR-001-stack.md`.
- **Gates.** `npm run gates` = typecheck + lint + test + build. CI lo ejecuta
  en cada PR. Rama `ft/SPEC-NNN-slug` para todo código vigilado.
