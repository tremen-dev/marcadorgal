---
id: SPEC-069
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
---
# SPEC-069 — La rfef acepta cualquier liveProvider de explorer

## Problema
**Daño (desde 2026-11-08 21:22Z).** Explorer v2.0 arbitra entre MARCA/Opta, ESPN y Football-Data y manda `liveProvider: "espn"` en algunos partidos. `src/sources/rfef/explorer.ts:75` (`z.enum(["marca","rfef"])`) rechaza el export **entero**: en 3 h, 138 `ingest_attempts` rfef con `ok=false` frente a 45 con `ok=true`, con partidos en juego. El titular aprobó el arreglo («sí»). Plazo: ya.

## Usuarios / roles afectados
- Público: deja de ver marcadores rfef congelados o sin señal por un campo informativo.

## Criterios de aceptación
- **CA-1 Proveedor abierto.** `ExplorerMatch.liveProvider` pasa a `z.string().min(1).optional()`, con un comentario que documenta los valores conocidos (`marca`, `rfef`, `espn`, `football-data`) como no cerrados. Test: `liveProvider: ""` sigue siendo error (el campo vacío no es un proveedor).
- **CA-2 Export con proveedor nuevo (test).** Fixture nuevo en `src/sources/rfef/fixtures/export/` con ≥ 1 partido `liveProvider: "espn"` y ≥ 1 con un proveedor inventado (`"proveedor-inventado"`), basado en un crudo real del 2026-11-08 si lo hay en Storage. Test en `explorer.test.ts`: el export parsea sin error, salen todas sus observaciones y el `liveProvider` llega tal cual.
- **CA-3 Nada cambia con lo de hoy (test).** Los fixtures `export-2026-10-31/11-01/11-02` producen exactamente las mismas observaciones que en `origin/main` 6148242 (mismo test, mismo resultado; ningún snapshot reescrito).
- **CA-4 Tipos espejo.** `src/lib/explorer-client.ts:57` y `src/lib/explorer-matches.ts:40` declaran `liveProvider?: string`; `npm run typecheck` → 0.
- **CA-5 Auditoría de enums.** En el esquema de explorer solo hay dos `z.enum` más: `estado` (`ExplorerStatus`) y `goals[].team`. Ambos **se quedan cerrados**: uno es el estado del partido y el otro a quién se atribuye un gol; un valor nuevo ahí es dominio y debe fallar alto. Test que lo fija: `team: "neutral"` y `estado: "HALFTIME"` siguen rechazando el export.
- **CA-6 Fronteras y gates.** `git diff --stat` solo en `src/sources/rfef/explorer.ts`, `src/lib/explorer-client.ts`, `src/lib/explorer-matches.ts`, tests y fixtures; nada en `src/decide/`, `src/model/` ni `supabase/`. `npm run gates` → 0.
- **CA-7 Producción.** Tras el despliegue (id y sha en el ledger), consulta de solo lectura en el ledger: `select ok, count(*) from ingest_attempts where source_id='rfef' and started_at > <despliegue> group by ok;` con ≥ 1 h de partidos en juego → `ok=false` = 0, o cada fallo con un `error` que no cita `liveProvider`.

## Entidades y reglas afectadas
Fuente, Observation (`dominio.md`); RN-09, RN-11 sin cambio; ADR-023 §4 (contrato de explorer), SPEC-049 (campo `liveProvider`).

## Fuera de alcance
- Usar `liveProvider` para decidir algo, o cambiar prioridades por proveedor.
- Tolerar valores nuevos de `estado` o `team`, o descartar partidos sueltos en vez de rechazar el export.

## Notas para el gate humano
- Ninguna decisión abierta. Riesgo aceptado por diseño: un proveedor mal escrito por explorer pasa sin aviso; no afecta al marcador.
