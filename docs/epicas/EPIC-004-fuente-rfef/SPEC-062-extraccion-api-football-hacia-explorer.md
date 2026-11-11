---
id: SPEC-062
tipo: spec
epica: EPIC-004
estado: hecho
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: bloqueada, fecha: 2026-11-08, por: sdd-implementador}
  - {estado: aprobada, fecha: 2026-11-11, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-11, por: sdd-verificador}
aprobada-por: Alberto Fojo
---
# SPEC-062 — Extracción de la lógica de API-Football hacia MarcadorGal Explorer

## Contexto y Justificación
Desde la adopción de `marcadorgal-explorer` v2.0 (ADR-023, ADR-026, SPEC-049), `marcador.gal` delega en Explorer la captura, resolución canónica, desofuscación y arbitraje multi-fuente de resultados, calendarios y estadísticas oficiales. 

Sin embargo, el repositorio de `marcadorgal` todavía conserva la implementación directa y las pruebas de `src/sources/api-football/`, su registro residual en `src/sources/registry.ts`, su adaptador en `src/ingest/adapters.ts`, su importador de calendario en `src/calendar/importers.ts` y referencias a `API_FOOTBALL_KEY` en `src/db/env.ts` y `tools/calendario-sync.mjs`.

El objetivo de esta especificación es:
1. **Desacoplar completamente `marcadorgal` de API-Football**: Convertir a Explorer en el único canal externo de datos deportivos (RFEF, MARCA y proveedores complementarios), eliminando código muerto, credenciales residuales y dependencias del proveedor directo en este proyecto.
2. **Trasladar la lógica a `marcadorgal-explorer`**: Integrar API-Football en Explorer como un proveedor más (`ApiFootballProvider` implementando `MatchResultsProvider`), donde convivirá de forma natural con RFEF y MARCA dentro de su arquitectura pluggable y motor de arbitraje.

---

## Criterios de Aceptación (para marcador.gal)

### CA-1: Desacoplamiento del núcleo de ingesta y adaptadores
- En `src/sources/registry.ts`, se retira la entrada de `api-football` de `SOURCES`. La única fuente activa pasa a ser `rfef` (vía explorer) con prioridad 50 (`FEDERATION_PRIORITY`).
- En `src/ingest/adapters.ts`, se elimina `createApiFootballResults` de la tabla `ADAPTERS`. La llamada a `adapterFor` solo resuelve las fuentes activas autorizadas.

### CA-2: Desacoplamiento de importadores de calendario
- En `src/calendar/importers.ts`, se elimina `apiFootballCalendar` del array `IMPORTERS`. `rfefCalendar` queda como el importador único oficial.
- La función `importerFor("api-football")` responderá `undefined` o se actualiza para rechazar proveedores retirados.

### CA-3: Saneamiento de herramientas CLI y variables de entorno
- En `src/db/env.ts`, se retira `API_FOOTBALL_KEY` de `REMOTE_SECRETS` (o se mantiene solo si fuese estrictamente necesario para compatibilidad retroactiva sin uso).
- En `tools/calendario-sync.mjs`, se elimina el flag `--source api-football` y la verificación obligatoria de `API_FOOTBALL_KEY`. El script utiliza exclusivamente las credenciales de Explorer (`RFEF_EXPLORER_TOKEN` / `EXPLORER_API_KEY`).
- En `.env.example` y configuraciones de despliegue, se elimina la recomendación de configurar `API_FOOTBALL_KEY`.

### CA-4: Aislamiento y retirada del directorio `src/sources/api-football/`
- Se retira el directorio `src/sources/api-football/` (`calendar.ts`, `events.ts`, `results.ts` y sus tests unitarios asociados).
- Para los tests de replay histórico de motor (`src/decide/replay.test.ts`) que verifican la monotonicidad y decisiones con capturas históricas de partidos de septiembre de 2026 (`girona-albacete`), se transforman o aíslan las observaciones pre-parseadas como fixture estática en `src/decide/fixtures/` (similar a `sabadell-andorra-2026-10-03.ts`), evitando que el test de replay dependa del código de un adaptador retirado.

### CA-5: Actualización de tests de arquitectura y contratos
- Se actualizan los tests de arquitectura (`src/arch/deploy.test.ts`, `src/arch/sources-boundary.test.ts`, `src/arch/source-contract.test.ts`) para certificar que no quedan importaciones ni acoplamientos a `api-football`.
- Se adaptan los tests de CLI (`src/calendar/cli.test.ts`) para que verifiquen el comportamiento de sincronización basado en el token de Explorer.

### CA-6: Gates en verde
- La ejecución de `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` debe completarse al 100% sin advertencias ni errores.

---

## Plan de Transferencia hacia Explorer (Visión Global)
La lógica extraída se traslada a `marcadorgal-explorer` estructurada de la siguiente manera:
1. **Proveedor:** `src/scraper/providers/api-football/api-football-provider.ts` implementando la interfaz `MatchResultsProvider`.
2. **Capacidades:** Soporte para sondeo de marcadores en directo (`live=...`), partidos por fecha (`fixtures?date=...`), estados con minutos y descanso (`HT`, `BT`), y extracción de eventos de gol (`events` -> `CanonicalGoalItem[]`).
3. **Mapeo de identidades:** Integración con `entityResolver` de Explorer para convertir IDs y nombres de equipos/ligas de API-Sports a los slugs canónicos unificados de `marcador.gal` (`primera-division`, `segunda-division`, `primera-rfef-g1`, `segunda-rfef-g1`, `tercera-rfef-g1`).
4. **Arbitraje y Fallback:** Configuración en `arbitration-engine` para que actúe como proveedor secundario o de contraste, respetando la prioridad federativa oficial de RFEF.
