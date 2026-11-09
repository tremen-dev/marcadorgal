---
id: SPEC-055
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-07, por: sdd-implementador}
---
# SPEC-055 — Soporte de Fútbol Femenino e integración con API Explorer v2.0

## Contexto y Problema
La API de `marcadorgal-explorer` expone y normaliza bajo el contrato v2.0 (ADR-023) los datos de competiciones de fútbol femenino: `liga-f` (Liga F Moeve, con el Deportivo ABANCA), `primera-federacion-fem` (Primera Federación Femenina RFEF) y `segunda-federacion-fem-g1` (Segunda Federación Femenina - Grupo 1, con As Celtas).
`marcador.gal` requería extender su modelo de datos, catálogo de clubes destacados, componentes de navegación y vistas de jornada/clasificación/calendario para dar soporte completo a las competiciones y clubes gallegos femeninos.

## Usuarios / roles afectados
- Afición y público general: pueden consultar en gallego y castellano los partidos, directos, clasificaciones y calendarios de las categorías de fútbol femenino, con seguimiento destacado de clubes gallegos (Deportivo ABANCA y As Celtas).

## Criterios de aceptación
- **CA-1 Modelo y Constantes de Competiciones.** Registro en `src/model/competitions.ts` de `'liga-f'`, `'primera-federacion-fem'` y `'segunda-federacion-fem-g1'`, con tipado Zod estricto, nombres oficiales, nombres cortos, tiers, categorías (`femenino` vs `masculino`) y colores temáticos sin valores hexadecimales crudos (cumpliendo `no-hex.test.ts`).
- **CA-2 Catálogo de Clubes Gallegos y Escudos.** Registro en `src/model/clubs.ts` de `depor-abanca` y `as-celtas` con identificadores canónicos, categoría, colores de club y escudos vectoriales en `public/escudos/`.
- **CA-3 Goles Embebidos y Estado en Directo.** Extensión de `src/model/public.ts` con `PublicGoal` (`team`, `player`, `minute`, `penalty`, `ownGoal`). Renderizado de goles embebidos, estado de descanso (`halfTime`) y minutos en vivo en `MatchRow.tsx` y `DirectosView.tsx`.
- **CA-4 Navegación y Vistas de Competición.** Componente `CompetitionNav` con filtro por categoría (*Todo*, *Fútbol Feminino*, *Masculino*). Rutas dinámicas en gallego y castellano:
  - `/competicion/[id]` y `/es/competicion/[id]`
  - `/clasificacion/[id]` y `/es/clasificacion/[id]`
  - `/calendario/[id]` y `/es/calendario/[id]`
  - `/directos` y `/es/directos`
- **CA-5 Cobertura RFEF y Fallbacks.** Actualización de `COVERED_COMPETITIONS` en `src/sources/rfef/calendar.ts` para cubrir las tres nuevas ligas.
- **CA-6 Calidad y Gates.** `npm run gates` (typecheck, lint, vitest y build de producción Next.js) pasa al 100% en verde.
