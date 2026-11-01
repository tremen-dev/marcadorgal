---
id: ADR-022
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
---
# ADR-022: Instante del último gol por equipo en la lectura pública

- Deciders: sdd-arquitecto propone (2026-11-01) para SPEC-041, a petición del titular. **Alberto Fojo elige el 2026-11-01, en las H de SPEC-041:** calcular al leer en la vista (H-1, §4), `decided_at` (H-2, §3) y solo goles vistos en directo (H-3, §2). El ADR sigue en borrador hasta el gate de SPEC-041.
- Specs relacionadas: SPEC-041 lo implementa. **Precisa ADR-014 §3** (añade dos campos a lo que ve el anónimo). No toca ADR-014 §2, §4-§6 ni ADR-015.

## Contexto

SPEC-041 necesita saber cuándo subió el marcador de cada equipo. `PublicMatch`
solo trae `observedAt` y `decidedAt` de la Decision vigente, que cambia con cada
minuto. El dato existe en `public.decisions` (append-only, RN-07): cada versión
guarda marcador, estado y `decided_at`. El público no lee ese log (ADR-014 §2),
y ahora mismo no se pueden tocar `src/sources`, `src/ingest` ni el motor
(`src/decide`, puro).

## Decisión

1. **Dos campos públicos más**: `homeScoredAt` y `awayScoredAt` (`Instant`
   nulables) en `PublicMatch` y, como `home_scored_at` y `away_scored_at`, al
   final de `web.xornada`. Son instantes de cuándo cambió el marcador, que ya es
   público: no revelan fuente, regla ni observaciones.
2. **Regla, por equipo**: el `decided_at` de la última Decision del partido que
   cumple tres cosas: es `live`; la Decision anterior del mismo partido también
   es `live` y tiene para ese equipo un marcador menor; ninguna Decision
   posterior tiene para ese equipo un marcador distinto. Si ninguna la cumple,
   `null`. Así, una bajada (gol anulado) da `null`, y una subida vista solo al
   cierre o en la primera Decision no cuenta.
3. **Reloj: `decided_at`**, el instante de la Decision. No se usa `observed_at`
   (reloj de la fuente) ni `recorded_at` (ADR-016: solo medición).
4. **Se deriva al leer, en la vista**: sin columna, tabla ni trigger nuevos. El
   motor y la ingesta no cambian. El payload de `board_delta` (fila de la vista,
   SPEC-024 N-2) los lleva sin cambiar el trigger.

## Consecuencias
### Positivas
- Un único sitio calcula la regla y lo comparten snapshot, `/api/board` y Realtime.
- Sin escrituras nuevas ni migración de datos: se revierte con otra vista.
### Negativas / follow-ups
- Cada lectura de la vista recorre las Decisions del partido: hay que medirlo (presupuesto en SPEC-041 CA-1). Si no cabe, el siguiente paso es materializarlo con su propio ADR.
- Si el operador (EPIC-004) corrige un marcador hacia arriba, cuenta como gol si es en `live`. Lo revisará la spec del operador.

## Alternativas consideradas
- **Columna escrita por el motor al decidir**: cálculo más barato, pero toca `src/decide`/`src/ingest` y cambia el contrato de la Decision. Rechazada ahora.
- **Detectarlo en el cliente comparando pintados**: no funciona sin JS, en la primera carga ni tras recargar. Rechazada.
- **Publicar el historial de marcadores**: amplía mucho ADR-014 §3 para usar solo un instante. Rechazada.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
