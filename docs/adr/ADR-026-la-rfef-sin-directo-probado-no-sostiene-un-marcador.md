---
id: ADR-026
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-03, por: sdd-arquitecto}
---
# ADR-026: La rfef sin directo probado no sostiene un marcador: cobertura en directo por competición, live contradicho, cierre forzoso `sen_sinal` y frescura del export

- Deciders: sdd-arquitecto propone (2026-11-03) a encargo del orquestador por el daño del 2026-11-02 (`primera-division-2026-27-j11-deportivo-osasuna`). **Alberto Fojo (titular)** fijó el marco: API-Football sigue en plan gratuito y la rfef será a menudo la única fuente; la parte de explorer la trabaja él fuera de tremen-sdd. Aprobación pendiente (gate de SPEC-046, H-1..H-4).
- Specs relacionadas: SPEC-046 (lo ejecuta); SPEC-039 (mide la cobertura que §1 declara); SPEC-044 / ADR-025 (trae el final del acta después). **Precisa, sin superseder:** ADR-023 §4 (letra de `lastSeenAt`) y §5 (mapeo de `LIVE_PROVISIONAL`); ADR-009 §4 y RN-02 (cualificador del cierre forzoso en un caso); ADR-010 §1-§2 intactos (manda la ganadora al cierre; RN-12 reconcilia). Enmienda la letra de **Cualificador** (`dominio.md`) y añade una nota a **RN-02**.

## Contexto
2026-11-02, Deportivo–Osasuna (Primera), real 2-1; publicado **0-0 `finished`**. API-Football: 0/359 intentos ok (plan gratuito). rfef: 215 observaciones `live` 0-0 de 20:02:45Z a 21:50:22Z sin un cambio. En explorer (acta 70694627) el 0-0 sale del panel «en juego» (`NFG_CMP_Paneles`, valor de arranque: la RFEF no llevaba el directo de ese partido); desde 20:31Z la página de jornada (`NFG_CmpJornada`) dice `SCHEDULED` y `isStaleCacheRegression` regla 2 la descarta (16 `READING_DISCARDED`), pero `recordDiscardedReading` refresca `last_seen_at`. Con `observedAt = lastSeenAt` (ADR-023 §5) el 0-0 parecía fresco. Motor correcto según su letra: v1 `live` 0-0 RN-01 `provisional`; v2 `finished` 0-0 RN-02 cierre forzoso con alerta. Lo equivocado es tratar como dato un valor que la RFEF nunca movió.

## Decisión
1. **Cobertura en directo de la rfef por competición.** El adaptador (`src/sources/rfef/explorer.ts`) solo convierte `LIVE_PROVISIONAL` en `live` en las competiciones declaradas con directo (constante `RFEF_LIVE_COMPETITIONS`); en las demás, `skipped: no_live_coverage`, contado. `FINISHED`, `POSTPONED` y `SUSPENDED` entran en las cinco, como hoy. Lista inicial: `primera-rfef-g1`, `segunda-rfef-g1`, `tercera-rfef-g1` (H-1). Añadir una competición es un cambio de dato con evidencia de jornada (SPEC-039), no un ADR.
2. **Live contradicho.** Una fila `LIVE_PROVISIONAL` con marcador 0-0 y `discardedReadings > 0` es `skipped: contradicted_live`: el único descarte posible sobre un 0-0 es de estado (regresión a `SCHEDULED`), que es la firma del valor de arranque. Una fila con goles y descartes sigue entrando (el gol es evidencia de directo; la bajada rancia ya la filtra explorer).
3. **Cierre forzoso sin respaldo: `finished · sen_sinal`.** A `kickoff + 120` RN-02 cierra como hoy (ADR-009 §4: siempre cierra, siempre alerta, con la marca de cierre forzoso, y el marcador de la ganadora por ADR-010 §1). Si el marcador que publica está **sin respaldo** —todas las observaciones con marcador de la línea de tiempo del partido son de **una sola fuente** con prioridad < `UNBACKED_CLOSE_PRIORITY` (= 10, `src/decide/thresholds.ts`) y **ninguna** trae un marcador distinto del publicado—, el cualificador es `sen_sinal` en vez de `provisional` y la alerta `forced_finish` lleva `details.unbacked = true`. RN-12 lo reconcilia igual cuando llegue el acta (SPEC-044). El esquema admite `sen_sinal` en `finished` solo con `forced_finish = true`.
4. **Frescura: `lastSeenAt` es la última lectura aceptada.** Letra nueva del contrato (ADR-023 §4): «`lastSeenAt` = instante de la última respuesta de la RFEF cuya lectura de esa fila explorer **aceptó** (no descartó); se refresca aunque no cambie nada». Cambio externo en explorer (`recordDiscardedReading` no toca `last_seen_at`); marcadorgal no cambia código. No arregla por sí solo este partido (las lecturas del panel sí se aceptaban): lo arreglan §1-§2.
5. **Letras nuevas.** **Cualificador** (`dominio.md`): «`sen_sinal` (sin datos en 15 min: en `live`, o en `scheduled` con kickoff pasado; o en `finished` por cierre forzoso sin respaldo, ADR-026 §3)». **RN-02** gana la nota «*Precisada el <fecha> por ADR-026: el cierre forzoso sale `sen_sinal` si el marcador no tiene respaldo.*» Su letra no cambia.

## Consecuencias
### Positivas
Con la rfef como única fuente en Primera/Segunda la pantalla dice «por xogar · sen sinal» durante el partido en vez de un 0-0 inventado, y el final llega del acta por ADR-025. Un 0-0 congelado que aun así se cuele cierra señalado, no como dato. El motor sigue puro y replayable.
### Negativas / follow-ups
- Un 0-0 real cubierto solo por la rfef (o por una sola fuente < 10) sale `sen_sinal` al cierre forzoso hasta el acta. Aceptado: honesto.
- Sin directo de la rfef, Primera/Segunda no tienen directo con API-Football en gratuito. Es la verdad, no una regresión.
- `discardedReadings` es acumulado desde `firstSeenAt`: un descarte de otra clase sobre un 0-0 también lo silencia. Si SPEC-039 lo ve, se afina con un campo nuevo del export.
- Migración de `decisions_sen_sinal_check`; la fila `finished · sen_sinal` ya la pinta `MatchRow` (etiqueta y marcador atenuado), se verifica.

## Alternativas consideradas
- **Sacar la rfef de Primera/Segunda**: perdería los finales del acta, que sí son buenos (SPEC-044 recuperó 7 de 8 de Primera).
- **Exigir un cambio de marcador por partido para aceptar el directo**: un 0-0 real nunca se prueba; sin medida de su coste.
- **No cerrar a +120 sin respaldo**: el partido quedaría `live` hasta 72 h (ADR-025 §2); contradice ADR-009 §4.
- **`finished` con marcador nulo**: cambia esquema, contrato público y UI más que §3, y pierde el dato que sí hay.
- **Solo la alerta (`provisional` + `unbacked`)**: sigue publicando como final un valor que nadie movió; el titular lo rechaza.
- **Pagar API-Football**: decisión del titular, fuera.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
