---
id: SPEC-085
tipo: spec
epica: EPIC-003
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-12, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
---
# SPEC-085 — TTFB de la xornada en fallo de caché

## Problema
Criterio 4 de EPIC-003 (primera pintura con 3G < 2 s) y H-3 de SPEC-026 («spec
de optimización priorizada por el tramo dominante»). Medido el 2026-11-11 desde
Galicia, sin emulación: en `MISS` el documento tarda 1,6–3,5 s en dar el primer
byte (`/`, `/es`, `/xornada/*`, `/api/board`); en `HIT`, 0,13–0,23 s. Con la
caché de ADR-014 §6 (10 s + 30 s rancio) y poco público, la primera visita
tras 40 s sin tráfico es un fallo. El tramo dominante es el servidor:
- funciones en iad1 contra base en Irlanda y Explorer en París (ADR-037);
- en `src/app/xornada-home.tsx:93-112` y `src/app/api/board/route.ts:13-35`
  (lógica duplicada) los goleadores y las ligas femeninas se esperan **en
  serie**, aunque las femeninas no dependen de las filas;
- `fetchWomenXornadaMatches` (`src/lib/explorer-xornada.ts:166-230`) pide el
  calendario oficial de 3 competiciones y los partidos por día **sin
  `timeoutMs`** (M-15) y **sin caché**: la rama `next: { revalidate: 15 }` de
  `src/lib/explorer-client.ts:148` nunca se activa (`"next" in fetch` es
  falso; el fetch parcheado de Next no tiene esa propiedad);
- goleadores y femeninas piden `getDayMatches` para las mismas fechas por
  separado.

## Usuarios / roles afectados
Público (primera visita y cambio de xornada sin caché). Titular: mide el campo.

## Criterios de aceptación
- **CA-1 Región.** `vercel.json` declara `"regions": ["dub1"]` (ADR-037). Test:
  unitario que lee `vercel.json`. Campo: `X-Vercel-Id` de un `MISS` de `/` en
  producción contiene `::dub1::` (ledger con la cabecera).
- **CA-2 Una lectura del tablero, en paralelo.** `/`, `/es` y `/api/board`
  obtienen sus `PublicMatch` de una sola función compartida con dependencias
  inyectadas (lector, Explorer, reloj). Dentro, las femeninas arrancan sin
  esperar a la base ni a los goleadores. Test: con dobles que tardan 100 ms
  (base), 100 ms (goleadores) y 100 ms (femeninas), la función resuelve en
  < 250 ms; el resultado es idéntico (`toEqual`) al de la composición en serie
  de hoy para los mismos dobles, incluidos los fallos parciales (Explorer cae →
  filas sin goleadores; femeninas caen → solo masculinas; base cae → `null`).
- **CA-3 Explorer con plazo en el render.** Toda llamada a Explorer desde
  `/`, `/es`, `/xornada/*` y `/api/board` lleva `timeoutMs`
  (`EXPLORER_ENRICHMENT_TIMEOUT_MS`). Test: con un doble que no responde, la
  lectura resuelve en ≤ plazo + 200 ms y sin femeninas.
- **CA-4 Calendario femenino cacheado.** El calendario oficial de cada
  competición femenina se reutiliza durante `WOMEN_CALENDAR_TTL_S` (H-2) entre
  peticiones de la misma instancia. Test con reloj inyectado: dos lecturas
  dentro del TTL → una llamada al calendario por competición; pasado el TTL →
  otra. Un fallo de Explorer no se cachea.
- **CA-5 Una petición por día.** En una lectura, cada fecha se pide a
  `/api/export/matches` como mucho una vez entre goleadores y femeninas. Test:
  contador del doble por fecha.
- **CA-6 Campo.** Antes del merge y después del despliegue, 10 `MISS` de `/` y
  10 de `/es` desde Galicia (`curl`, pausa ≥ 45 s; `X-Vercel-Cache: MISS`
  comprobado), con mediana y máximo del TTFB en el ledger. Cumple si la
  mediana de cada ruta baja de **800 ms** (H-1). Además, una corrida de
  `npm run primera:pintura -- --n 20` (SPEC-026) con su veredicto.
- **CA-7 Sin cambio visible.** Mismo HTML para los mismos datos (e2e de
  `xornada*.spec.ts` en verde), `npm run gates` en verde; `src/sources`,
  `src/decide` y `src/ingest` intactos; el PR sube `patch` (ADR-028).

## Entidades y reglas afectadas
Board, Frescura (`dominio.md`); D-9 (un fallo de Explorer nunca se pinta como
estado). ADR-014 §6 (caché, sin cambios), ADR-033, ADR-037. SPEC-020, SPEC-024,
SPEC-026, SPEC-059 (plazo de goleadores), M-15 de EPIC-MANT (cubre la parte de
render; ingesta y `/directos` siguen allí).

## Fuera de alcance
Cambiar la caché de ADR-014 §6 o cachear más tiempo las semanas pasadas (spec
propia, toca ADR-014). Cache Components / `'use cache'` (ADR propio).
Skeletons. Speed Insights (ADR-038). Mover Explorer de región (servicio
externo). Reducir el JS del cliente.

## Notas para el gate humano
- **H-1 Umbral de CA-6.** Recomendado 800 ms de mediana en `MISS` (deja
  ~1,2 s para transferencia y render con 3G). *Hipótesis*: no hay medición en
  dub1 todavía; si CA-1 sola ya lo cumple, el resto sigue valiendo por M-15.
- **H-2 TTL del calendario femenino.** Recomendado 1 h: el calendario cambia
  por aplazamientos, no minuto a minuto; el directo viene de `matches`.
- **H-3 Orden.** CA-1 es un cambio de configuración aislable: puede ir en su
  propio PR primero para medir su efecto por separado. Recomendado.
