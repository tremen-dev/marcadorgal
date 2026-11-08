---
id: SPEC-060
tipo: spec
epica: EPIC-003
estado: implementada
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: implementada, fecha: 2026-11-08, por: sdd-implementador}
---
# SPEC-060 — Ingesta histórica de resultados y goleadores desde la jornada inicial hasta la actual

## Contexto y Problema
En la temporada 2026-27 se han disputado **552 partidos** entre el 14 de agosto y el 8 de noviembre de 2026 a lo largo de 60 fechas en las cinco divisiones oficiales (Primera División, Segunda División, Primera RFEF G1, Segunda RFEF G1 y Tercera RFEF G1).

Actualmente:
1. En la portada (`HomeXornada`), SPEC-059 enriqueció en memoria los partidos de la jornada en curso mediante consultas dinámicas a `getDayMatches` de Explorer v2.0.
2. Sin embargo, las jornadas pasadas consultadas mediante navegación (`/xornada/[fecha]`, `WeekXornada`) leen directamente de la base de datos PostgreSQL (`web.xornada`), la cual carece de tabla para persistir eventos de gol de cada partido (`goals: undefined`).
3. Además, si durante ciertas semanas históricas el motor de ingesta estuvo apagado o sin cobertura (como ocurrió con la retirada del plan de API-Football antes de SPEC-049), existen partidos antiguos sin estado final consolidado (`finished`) en `decisions`.

Para que la web esté completa y actualizada tanto en la portada como en el histórico de jornadas anteriores, es necesario persistir de forma estructurada los resultados finales y los goleadores reales de todos los partidos disputados desde la jornada 1 hasta la fecha.

### Modelo de ejecución (One-time)
Esta ingesta se ejecuta **una sola vez (one-time back-fill)** para cargar los datos históricos de resultados y goleadores desde el inicio de la temporada hasta la jornada actual. No está programada ni prevista como tarea periódica o recurrente; se lanza manualmente mediante el script CLI (`npm run historico:sync`) cuando el operador requiera consolidar o reparar el histórico.

## Usuarios y roles afectados
- **Afición y visitantes de `marcador.gal`:** pueden consultar cualquier jornada pasada (`/xornada/[fecha]`) y desplegar interactivamente los autores y minutos de los goles conforme a SPEC-056.
- **Operador / Titular:** dispone de una herramienta CLI controlada e idempotente para sincronizar o reparar el histórico de partidos y eventos sin coste económico adicional (asumido por Explorer v2.0).

## Criterios de aceptación
- **CA-1 Modelo y persistencia relacional de eventos de gol (`match_goals`).**
  - Migración SQL en `supabase/migrations/` que cree la tabla `public.match_goals`:
    - Campos: `id uuid primary key default gen_random_uuid()`, `match_id text references public.matches(id)`, `team text check (team in ('home', 'away'))`, `player text not null`, `minute integer not null check (minute >= 0)`, `penalty boolean default false`, `own_goal boolean default false`, `created_at timestamptz default now()`.
    - Índice compuesto `(match_id, minute asc)`.
    - Políticas RLS: lectura concedida al rol `web_reader` y al esquema `web`.
- **CA-2 Herramienta de ingesta histórica (`tools/historico-sync.mjs`).**
  - Script ejecutable mediante `npm run historico:sync -- [--desde <YYYY-MM-DD>] [--hasta <YYYY-MM-DD>] [--dry-run]`.
  - Si no se indican fechas, toma por defecto desde el inicio de la temporada (`2026-08-14`) hasta la fecha actual (`now`).
  - Obtiene los partidos y goles llamando a `getDayMatches(date)` de Explorer v2.0 (`src/lib/explorer-client.ts`) para cada fecha con partidos declarados.
  - Aplica el saneamiento de placeholders (conforme al filtro de SPEC-059: descarta `"Goleador Local"`, `"Goleador Visitante"`, nombres vacíos o ficticios).
  - Inserta o actualiza en una transacción por jornada los marcadores finales en `observations`/`decisions` y los goles en `public.match_goals`.
- **CA-3 Integración en la lectura pública histórica (`WeekXornada`).**
  - La consulta o vista de lectura para semanas históricas (`src/board/week-read.ts` / `WeekXornada`) incorpora los goles asociados a cada partido a partir de `public.match_goals`.
  - Los partidos con goles en semanas pasadas permiten el despliegue interactivo del acordeón de goleadores en `MatchRow.tsx` (SPEC-056).
- **CA-4 Idempotencia y trazabilidad.**
  - La ejecución repetida de la herramienta con o sin `--dry-run` no genera duplicados en `public.match_goals` (clave única o reemplazo determinista por partido).
  - El modo `--dry-run` desglosa el número de partidos a consolidar y el número de goles a registrar por jornada y competición sin escribir en la base de datos.
- **CA-5 Calidad, pruebas y gates.**
  - Suite de tests unitarios para la sincronización histórica y el mapeo de eventos en `src/ingest/historico.test.ts`.
  - Verificación en local con `npm run test:db` y `npm run gates` 100% en verde.

## Entidades y reglas afectadas
- `supabase/migrations/` (nueva migración para `match_goals`).
- `src/model/` (tipo `GoalEvent` / `PublicGoal` unificado en modelo).
- `src/board/week-read.ts` y `src/app/xornada-week.tsx`.
- `tools/historico-sync.mjs` y `package.json` (`historico:sync`).
- D-3 (Alcance de 5 divisiones), D-6 (Trazabilidad), SPEC-056 y SPEC-059.

## Fuera de alcance
- Tarjetas amarillas, rojas y sustituciones (no contempladas en el contrato de eventos de Explorer v2.0).
- Modificación del motor de decisiones en vivo de `src/decide/` (los partidos cerrados del histórico se procesan como estados finales consolidados).
