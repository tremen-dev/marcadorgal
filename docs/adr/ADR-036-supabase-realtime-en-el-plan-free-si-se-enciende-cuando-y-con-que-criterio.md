---
id: ADR-036
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
---
# ADR-036: Supabase Realtime en el plan Free: si se enciende, cuándo y con qué criterio

- Deciders: sdd-arquitecto propone (2026-11-11) a petición del titular («¿con Free se puede usar Realtime para que los goles lleguen antes que con el polling de 30 s?»); pendiente de aprobación de Alberto Fojo (titular).
- Specs relacionadas: SPEC-024 (H-3, H-6, N-1; lo que hay desplegado), SPEC-025 (latencia gol → pantalla, sin cifras todavía), ADR-033 §6 y G-2 (pico de simultáneos), EPIC-009 piezas 3 y 4. ADR-002 §7, ADR-014 §5-§7, ADR-024.

## Contexto
Hoy: trigger `board_delta` deshabilitado, sin `NEXT_PUBLIC_REALTIME`: todo es polling de `/api/board` cada 30 s ±20 % (`POLL_MS`), en pausa con la pestaña oculta, detrás de la CDN con `s-maxage=10, stale-while-revalidate=30`. El tick sondea cada 30 s. Con Realtime (SPEC-024), un cliente `SUBSCRIBED` **deja de sondear** y reconcilia cada 5 min; si falla, polling y reintento de 60 s a 5 min. El trigger es `FOR EACH ROW`: **un mensaje por Decision**, y una Decision cambia también con el minuto (`dominio.md`).

**Límites de Free** (docs de Supabase consultadas el 2026-11-11: `realtime/limits`, `manage-your-usage/realtime-messages`, `billing-faq`, `pricing`): 200 conexiones simultáneas (la 201 se rechaza, `too_many_connections`); 2 M mensajes/mes; 100 mensajes/s (por encima, **desconecta**, `tenant_events`); 100 uniones/s; payload de broadcast 256 KB (una fila de `web.xornada` cabe sobrada). Un broadcast cuenta «1 enviado + 1 por cliente suscrito que lo recibe». Pro: 25 $/mes, 500 conexiones (+10 $/1.000), 5 M mensajes (+2,50 $/M), 500 mensajes/s, spend cap encendido por defecto.
**Pasar la cuota en Free** no corta solo Realtime: aviso, periodo de gracia sin duración publicada y luego restricción de uso razonable, que «puede» ser pausar el proyecto, base **en solo lectura** o **402 en todas las peticiones**, aplicada a **todos los proyectos de la organización**. Nuestra única Supabase remota es producción: el tick dejaría de escribir. **El fallback a polling (D-9) cubre que Realtime rechace; no cubre esto.**
*Hipótesis:* no consta si los latidos y las uniones cuentan como mensajes, ni si el límite de 100/s cuenta el reparto a cada receptor.

**Modelo de coste.** Mensajes/mes = Σ Decisions × (1 + receptores conectados en ese instante). *Hipótesis D:* 3.350 Decisions por fin de semana (SPEC-009, con API-Football; no se ha medido con la rfef) × 4,3 ≈ **14.400/mes**. *Hipótesis D′:* solo goles y cambios de estado ≈ **1.150/mes** (≈ 39 partidos × (2,7 goles + 4 estados) × 4,3). Por encima de 200, el resto va a polling y no gasta mensajes.

| Receptores medios durante el directo | 50 | 100 | 150 | 200 (tope) |
|---|---|---|---|---|
| Todas las Decisions (D) | 0,73 M (37 %) | 1,45 M (73 %) | 2,17 M (**109 %**) | 2,91 M (**145 %**) |
| Solo goles y estado (D′) | 0,06 M | 0,12 M | 0,17 M | 0,23 M (12 %) |

Ráfaga: un tick con *k* Decisions a la vez manda *k* × R mensajes en un segundo. Con 10 inicios a las 17:00 y R = 50 son 500: si el reparto cuenta para el límite de 100/s, Free desconecta a todos incluso con D′.

**Latencia gol → pantalla, tramo propio** (sin el retraso de la fuente, que SPEC-025 aún no ha medido): tick 0-30 s + CDN 0-10 s + espera del cliente. `vision.md` pide mediana < 45 s y p95 < 90 s **extremo a extremo**.

| Opción | Tramo propio (media / peor) | Coste | Riesgo de cuota |
|---|---|---|---|
| A. Solo polling 30 s (hoy) | ~35 s / ~76 s | 0 | ninguno |
| B. Polling 15 s | ~28 s / ~58 s | dobla peticiones a la CDN; G-2 pasa a ÷ 4 | ninguno |
| C. Realtime en Free como SPEC-024 | ~16 s / ~31 s | 0 | **alto** con D y R ≥ 140; ráfaga sin medir; lo pagaría la producción entera |
| C′. Realtime en Free «acelerador» (solo D′, polling sigue a 30 s) | ~16 s en goles; resto como A | 0 | bajo en cuota (≤ 12 %); ráfaga sin medir |
| D. Pro | como C | 25 $/mes | spend cap: >500 conexiones a polling; la cuota sin margen también restringe |

## Decisión (propuesta)
1. **Realtime no se enciende hoy.** Sigue A. B se descarta: ~7 s de mejora media a cambio de doblar la carga de la CDN, justo lo que mide la pieza 4.
2. **Si se enciende en Free, es en modo acelerador (C′)**, por spec nueva que enmienda SPEC-024: el trigger solo emite si cambian `status`, `home_score` o `away_score`; el cliente suscrito **sigue sondeando a 30 s** (minuto, membresía y frescura no dependen del socket, y `/api/board` ÷ 2 sigue midiendo el pico de G-2). El modo SPEC-024 (Realtime sustituye al polling) solo con Pro.
3. **Criterio de activación**, todo medido: (a) G-2 resuelta y R medio durante el directo de las 4 últimas jornadas conocido; (b) Decisions reales del último mes contadas por clase (consulta de solo lectura de abajo); (c) previsión D′_real × (1 + R) ≤ **1 M/mes** (50 % de la cuota); (d) prueba de ráfaga de la pieza 4 en un proyecto Free **de otra organización** (nunca la de producción): con *k*_máx real de un tick y R previsto, sin `tenant_events`, y medido si latidos y reparto cuentan. Si falla (c) o (d): Pro, o quedarse en A.
4. **Vigilancia en Free:** revisar el uso de mensajes del panel cada lunes de jornada; al 50 % de la cuota, marcha atrás.

```sql
-- Solo lectura. Decisions del último mes, todas y solo goles/estado (D′).
select count(*) total,
       count(*) filter (where status is distinct from p_status
                         or home_score is distinct from p_home
                         or away_score is distinct from p_away) goles_y_estado
from (select *, lag(status) over w p_status, lag(home_score) over w p_home,
             lag(away_score) over w p_away
      from public.decisions window w as (partition by match_id order by version)) d
where decided_at >= now() - interval '30 days';
```

**Precondición (goleadores):** el delta de `board_delta` lleva la fila de `web.xornada`, cuyos `goals` salen de `match_goals`, que está vacía en directo (los goleadores en directo los añade `enrichMatchesWithGoals` al leer de explorer). Como `applyDelta` (`src/xornada/live.ts`) sustituye la fila entera, cada delta borra los goleadores pintados hasta el siguiente `/api/board`: 30 s con C′ y `RECONCILE_MS` (5 min) en el modo SPEC-024. La spec de C′ debe resolverlo, por ejemplo conservando los goles pintados si el delta no trae goles.
**Activación** (orden de N-1, la base antes que la variable): 1) cerrar el alta de usuarios en Auth y comprobarlo; 2) spec de C′ aprobada y desplegada con la variable apagada; 3) migración `enable trigger board_delta` por GitHub Actions (ADR-024); 4) `NEXT_PUBLIC_REALTIME=on` **solo en Production** y redespliegue; 5) primer día: conexiones pico y mensajes en el panel.
**Marcha atrás**: 1) migración `disable trigger board_delta`, que corta los mensajes al momento (con C′ el polling sigue y nadie ve un dato viejo); 2) quitar la variable y redesplegar, que cierra los sockets. El alta en Auth sigue cerrada.

## Consecuencias
### Positivas
- Ningún riesgo de restricción sobre producción hasta tener números; los goles ganarían ~20 s de media cuando se encienda.
- C′ conserva la fuente del pico de G-2 y un interruptor de emergencia que no exige redesplegar.
### Negativas / follow-ups
- Hasta entonces el tramo propio gasta ~35 s de los 45 s de mediana: si la fuente tarda más de ~10 s, A incumple `vision.md`. SPEC-025 debe dar cifras.
- C′ exige spec (trigger filtrado y cliente híbrido) y la pieza 4 una prueba de ráfaga en otra organización.

## Alternativas consideradas
- **C tal cual (SPEC-024 en Free):** con D, la cuota se pasa a partir de ~140 receptores medios, y el castigo es para toda la organización. Rechazada.
- **B (15 s):** mejora pequeña, dobla peticiones. Rechazada.
- **D (Pro ya):** 25 $/mes antes de saber si hace falta; queda como salida si falla el criterio.
- **Agrupar Decisions por tick en un mensaje:** toca el motor (fuera de alcance en SPEC-024) y no arregla el reparto por receptor.

## Preguntas para el titular
- **P-1** ¿No encender hoy y decidir con el criterio de la decisión 3? Recomendado: sí.
- **P-2** Resolver G-2 de ADR-033 (Observability Plus) es requisito de la decisión 3 (a). Recomendado: sí, antes de la pieza 3.
- **P-3** ¿Modo acelerador (C′) en lugar del modo de SPEC-024 mientras estemos en Free? Recomendado: sí.
- **P-4** ¿Lanzas tú la consulta de solo lectura en producción para fijar D y D′ reales? Recomendado: sí, en el editor SQL; sustituye las hipótesis.
- **P-5** Prueba de ráfaga en un proyecto Free de una organización aparte, dentro de la pieza 4. Recomendado: sí.
- **P-6** Umbral de previsión: 50 % de la cuota (1 M/mes). Recomendado: 50 %.
- **P-7** Preview sin Realtime (comparte la base de producción y gastaría conexiones). Recomendado: solo Production, lo que enmienda N-1 de SPEC-024.
- **P-8** Si falla el criterio, ¿Pro (25 $/mes con spend cap) o quedarse en polling? Recomendado: Pro solo si R medio > 140 o falla la ráfaga y SPEC-025 muestra que A incumple `vision.md`.
