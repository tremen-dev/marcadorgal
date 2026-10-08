---
id: SPEC-024
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-08, por: sdd-arquitecto}
---
# SPEC-024 — Realtime, fallback y frescura

## Problema
`/` y `/es` son un snapshot (SPEC-020): quien deja la pantalla abierta ve el
marcador de cuando cargó y nada le dice su edad. Criterio 5 de EPIC-003: si
Realtime cae, la pantalla sigue por polling y dice cuándo se actualizó; un fallo
de transporte nunca se pinta como estado del partido (D-9, RN-11). ADR-014 §5-§7
fija el canal; falta el trigger, la política, el cliente y la frescura.

## Usuarios / roles afectados
- Público: la xornada se actualiza sola y dice su edad. Sin JS, el snapshot de hoy.
- Titular: migración, dos variables `NEXT_PUBLIC_*` y orden de despliegue (N-1).

## Criterios de aceptación
- **CA-1 Trigger (ADR-014 §5, N-2).** Migración: esquema `private` (fuera de `api.schemas`, `revoke all … from public`); `private.send_board_delta(match_id)` lee la fila de `web.xornada` de ese partido y llama a `realtime.send(payload, 'decision', 'board:' || season, true)`; trigger `AFTER INSERT … FOR EACH ROW` en `public.decisions` que la invoca. Funciones `security definer`, `search_path` vacío, `EXECUTE` revocado a `public`, `anon`, `authenticated`. Un error al emitir es `warning` y **nunca** aborta la Decision. `.db.test` (transacción con rollback): insertar una Decision deja una fila en `realtime.messages` con ese tema, evento y `private`; su payload tiene **exactamente** las columnas de `web.xornada` y es igual a la fila de la vista; ninguna clave de `rule`, `observation_ids`, `*_source_id`, `forced_finish`; con `send_board_delta` sustituida por una que lanza, el `insert` se confirma.
- **CA-2 Política y privilegios (ADR-014 §5, ADR-015 §3).** Política `board_receive` en `realtime.messages`: `SELECT` para `anon` si `extension = 'broadcast'` y `realtime.topic() like 'board:%'`; ninguna de `INSERT`/`UPDATE`/`DELETE`. `.db.test`: como `anon`, ve los mensajes `board:%` y no otros, e `insert` falla; `authenticated` no ve ninguno; ni `anon`, ni `authenticated`, ni `web_reader` tienen `USAGE` en `private` ni `EXECUTE` en sus funciones. El inventario de ADR-015 §3 sigue verde **sin tocar** su residuo, y los asertos de SPEC-020 CA-2 siguen verdes.
- **CA-3 Una sola conversión.** La de `src/board/row.ts` acepta instantes `Date` (lector) o cadena (payload) y devuelve `PublicMatch` con `Z`. Test: el mismo partido por el lector y por el payload da objetos iguales; un payload inválido se descarta con `console.error` que nombra el `matchId` y no toca la pantalla.
- **CA-4 Estado en cliente (H-1, H-7).** Un componente cliente mantiene `matchId → PublicMatch` y pinta secciones, lateral y píldoras con los componentes de hoy; un `PublicMatch` (delta o `/api/board`) reemplaza al pintado solo si su `version` es mayor. Un `matchId` desconocido pide `/api/board` (≤ 1 vez / 30 s); una respuesta 200 añade y quita partidos según su lista y, solo entonces, recalcula los días. Test de tabla del reductor puro: versión igual o menor → nada; mayor → reemplazo; desconocido → petición; altas y bajas. El HTML servido no cambia (e2e sin JS de SPEC-019/020/023 en verde) y sin errores de hidratación en consola.
- **CA-5 Filtro y plegado (SPEC-023 N-2).** Tras cada repintado se reaplica el fragmento (filas, secciones, contadores, `nada aquí`); un `<details>` cerrado sigue cerrado; el fragmento no cambia. `e2e:db`: con una competición plegada y `#f=live`, una Decision que pasa un partido a `finished` lo quita de la vista, actualiza los contadores y deja plegado y fragmento.
- **CA-6 Transporte (H-3, ADR-014 §7).** `@supabase/supabase-js` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon o publishable), `persistSession`, `autoRefreshToken` y `detectSessionInUrl` a `false`; canal `board:<season>` privado (temporada de la xornada servida). `SUBSCRIBED` → para el polling, una petición de puesta al día y reconciliación cada 5 min. `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` o sin `SUBSCRIBED` en 10 s → cierra el socket, polling, y reintenta Realtime a los 60 s doblando hasta 5 min (±20 %). Sin las variables, solo polling. Tests con canal, `fetch` y reloj dobles. E2e: `document.cookie` vacío y nada en `localStorage`/`sessionStorage`.
- **CA-7 Polling (H-2, ADR-002 §7).** Cada 30 s ±20 % a `/api/board` con `If-None-Match` del último `ETag` y `cache: "no-store"`; 304 solo mueve el reloj del navegador; se pausa con la pestaña oculta y pide al volver. Fallo de red o 503 → modo «sen conexión»; **los partidos no cambian**. Test con dobles: 20 min de fallos dejan `status`, `qualifier` y marcador idénticos (D-9).
- **CA-8 Frescura de pantalla (D-9, RN-11, H-5).** Una línea fuera de la tabla, entre los controles y la primera competición. Servida: «Actualizado ás HH:MM» (instante de render, `Europe/Madrid`). En cliente, con el reloj del navegador (último delta, 200/304 o latido correcto del socket en `SUBSCRIBED`): «Actualizado agora» (< 1 min) o «hai N min». En polling añade «Sen tempo real: actualízase cada 30 s»; sin conexión, «Sen conexión». Solo el aviso es `role="status"`. Texto, sin color de estado (tokens neutros); nunca en una fila. Claves en `src/i18n/` con paridad gl/es; función pura `(último, ahora) → clave, n` con test de tabla.
- **CA-9 Frescura de fila (RN-11, H-4).** Una fila `live` (descanso y `sen_sinal` incluidos) con `observedAt` de hace ≥ 2 min muestra `freshness.lastData` («último dato hai N min»), minutos hacia abajo, recalculada cada 30 s sin red; ninguna otra fila la muestra. Test puro; Playwright a 360, 390, 1024 y 1440 px sin truncado (D-2) ni scroll horizontal.
- **CA-10 E2e con Realtime local.** `e2e:db` (gl y es; 390 y 1440): insertar una Decision en local repinta la fila en < 5 s sin recargar; con `routeWebSocket` cerrando el socket, aparecen el aviso y peticiones a `/api/board` con `If-None-Match`; con `/api/board` abortado, las filas no cambian. Las demos no se suscriben ni sondean.
- **CA-11 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde. Única dependencia nueva: `@supabase/supabase-js`. `git diff main --stat -- src/sources src/decide src/ingest` vacío. Ledger: First Load JS de `/` antes y después (`next build`) y tiempo de insertar 50 Decisions con y sin trigger en local.

## Entidades y reglas afectadas
Board, Decision, Frescura, Estado de partido, Cualificador (`dominio.md`); RN-05,
RN-07, RN-11; D-2, D-8, D-9. ADR-002 §6-§7, ADR-014 §3 y §5-§7 (implementa),
ADR-015 §3. SPEC-019 (`PublicMatch`, fila), SPEC-020 (lector, `/api/board`),
SPEC-021, SPEC-023 (CA-6, N-2).

## Fuera de alcance
Medición de latencia y primera pintura (spec siguiente); navegar entre xornadas;
agrupar Decisions por tick (tocaría el motor); Supabase Pro (jornada publicada).

## Notas para el gate humano
- **H-1 Estado React, no parche del DOM.** Recomendado: una fuente de verdad que reutiliza `MatchRow` y `buildXornada`; parchear el DOM duplicaría la fila, el orden y los contadores. Enmienda SPEC-023 CA-6 («un único componente cliente»): pasan a dos, o se funden.
- **H-2 Polling a 30 s**, el de ADR-002 §7 y el del tick; con `s-maxage=10`, bajar de 10 s no aporta y 15 s duplica peticiones al CDN de quien no cabe en Realtime. Recomendado: 30 s.
- **H-3 Reintento lento de Realtime** (60 s → 5 min): en Free, cientos de clientes rechazados reintentando a 1-10 s (por defecto) saturarían las uniones. Recomendado.
- **H-4 Edad por fila solo en `live` ≥ 2 min.** RN-11 literal la pone en toda fila; en `finished` o `scheduled` es ruido y en `live` fresco también. El diseño no la dibuja (D-8): bajo la fila, `--fg-dim`. Recomendado.
- **H-5 Indicador neutro**: rojo y ámbar son estados de partido (ADR-005); el aviso de transporte con ellos rozaría D-9. Recomendado.
- **H-6 Free.** 200 conexiones: el resto queda en polling (CA-6). Pero los mensajes cuentan por receptor: SPEC-009 midió 3350 Decisions en un fin de semana; con 150 espectadores medios son ~2 M/mes, la cuota Free que debe confirmar el titular. Interruptor: quitar `NEXT_PUBLIC_SUPABASE_ANON_KEY` y redesplegar → todo polling. Recomendado: medir en la jornada y Pro antes de publicar (ADR-014 §1).
- **H-7 Membresía.** Un partido de otra ronda que entra en `live` o el cambio de ronda del miércoles llegan por `/api/board` (CA-4), con Realtime en ≤ 5 min. Recomendado.
- **N-1 Orden de despliegue.** La base va antes que el código: con el cliente y sin trigger, la pantalla diría «Actualizado agora» sin recibir nada. 1) Solo lectura en producción: existe `realtime.send`, RLS activo en `realtime.messages`, y en Auth el alta de usuarios está cerrada (la clave va al navegador). 2) `npm run db:push`: compatible, no hay suscriptores. 3) Las dos `NEXT_PUBLIC_*` en Production y Preview. 4) Merge y despliegue. Marcha atrás: quitar la clave (todo polling); el trigger se retira con otra migración.
- **N-2 Precisión de ADR-014 §5.** «Publica la fila `PublicMatch`»: el payload es la fila de `web.xornada` (sin lectura nueva ni segunda lista de columnas) y el cliente la convierte con la misma función que el lector (CA-3). `security definer` para que el futuro operador (EPIC-004) emita sin permisos en la vista; una función de trigger no se puede invocar a mano. Sin ADR nuevo.
- **N-3** CI no corre `test:db` ni `e2e:db` (SPEC-020 N-4): los corre el verificador en local. El nombre del latido en `supabase-js` lo confirma el implementador; si no existe, el reloj avanza con deltas y reconciliación y se dice aquí.
- **N-4 Una página**, al límite. Si se parte: CA-1-CA-3 (base) y CA-4-CA-10 (cliente).
