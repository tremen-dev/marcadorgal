# marcador.gal

**Todo o fútbol galego nunha pantalla.**

Resultados en directo de las cinco divisiones españolas con equipos gallegos
(Primera, Segunda, Primera RFEF G1, Segunda RFEF G1, Tercera RFEF G1), jornada
completa, en una sola pantalla y en galego. Proyecto de [tremen.dev](https://tremen.dev).

Sucede a una versión previa ([tremen-dev/marcador.gal](https://github.com/tremen-dev/marcador.gal))
que no llegó a publicarse; de ella hereda el sistema de diseño y el modelo de
datos. Inspiración de marcadorgalego.gal, no sucesión.

## Estado

**Commit fundacional, sin código.** Ver `docs/tablero.md` y `docs/roadmap.md`.

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
| `docs/adr/` | Decisiones técnicas |
| `docs/diseno/` | Sistema de diseño (vinculante) |
| `docs/roadmap.md` | Secuencia de épicas |
| `docs/tablero.md` | Estado agregado (generado, no editar) |

## Stack

Next.js 16 · React 19 · TypeScript · zod · Supabase (Postgres, Realtime, Auth,
Storage) · Vercel. Detalle en `docs/adr/ADR-001-stack.md` y `ADR-002`.
