---
id: SPEC-066
tipo: spec
epica: EPIC-007
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-09, por: sdd-implementador}
---
# SPEC-066 — Goles a la cola de redes: detección, outbox, publicador con doble, plantillas y configuración

## Problema
EPIC-007 quiere un tweet por gol en directo de un equipo vigilado. El gol hoy solo existe al leer (`web.xornada`, ADR-022); nada lo registra ni recuerda si ya se contó. Esta spec construye todo lo que no depende de Buffer (ADR-030): detectar el gol y el gol anulado (RN-03) junto a la Decision, registrarlo, redactarlo y despacharlo por un puerto. Sale **apagada, en modo seco**: producción registra y redacta, no publica. SPEC-067 enchufa Buffer.

## Usuarios / roles afectados
- Titular: lee en `social_posts` qué se habría publicado y cambia equipos vigilados y ligazón con variables.
- sdd-implementador de SPEC-067 (consume el puerto). El público no ve nada todavía.

## Criterios de aceptación
- **CA-1 Tabla.** Una migración crea `public.social_posts`: `id uuid` pk; `decision_id uuid not null` → `decisions`; `match_id text not null` → `matches`; `side` (`home`|`away`); `kind` (`goal`|`goal_annulled`); `status` (`pending`|`sending`|`sent`|`failed`|`expired`|`skipped`, por defecto `pending`); `attempts int` (0); `reason`, `template_id`, `text`, `provider`, `provider_post_id` nulables; `created_at` (por defecto `clock_timestamp()`) y `closed_at`. `unique (decision_id, side)`, índice parcial sobre las abiertas (`pending`, `sending`), RLS activado sin políticas. Solo crea (ADR-024 §3). Test de base: como `web_reader`, `select` da 42501 y el inventario de ADR-015 §3 sigue verde.
- **CA-2 Regla pura.** `goalEvents(current, next)` en `src/ingest/` (sin SQL ni reloj) devuelve los eventos de ADR-030 §1. Test de tabla: `live` 0-0 → `live` 1-0 `confirmado` = `goal` `home`; lo mismo `provisional` = nada; vigente `sen_sinal` 1-0 → `confirmado` 2-0 = `goal`; `live` 1-0 → `live` 0-0 con cualquier cualificador = `goal_annulled`; 0-0 → 1-1 = dos eventos; 0-0 → 2-0 = uno; sin vigente, `scheduled` → `live` 1-0 y `live` → `finished` con marcador mayor = nada.
- **CA-3 Se escribe con la Decision.** Dado un partido `live` y una observación que sube el marcador, cuando corre `decideMatches`, entonces hay una fila `pending` por evento con el `decision_id` de la Decision nueva. Dos `decideMatches` concurrentes sobre el mismo partido (patrón de SPEC-035) dejan una sola. `decideRecovered` y `replay:jornada --aplicar` no dejan ninguna. Con `social_posts` renombrada en la base de test, la Decision se escribe igual y el error sale en una línea de log. (`engine.db.test.ts`.)
- **CA-4 Puerto y doble.** `src/social/` exporta `SocialPublisher` (un texto → `sent` con id | `rejected` | `retry` | `unknown`) y un doble en memoria que responde según un guion y registra lo que recibe. Ningún test de esta spec toca la red.
- **CA-5 Despacho.** `dispatchSocial` recibe publicador, configuración, `now` y RNG, y trata las filas `pending` por orden de `created_at`. Con el doble: `sent` → fila `sent` con `provider`, `provider_post_id` y `closed_at`; `rejected` → `failed`; `retry` → vuelve a `pending`, no se llama más en ese tick, y al tercer `retry` queda `failed` (`attempts_exhausted`); `unknown` → `failed` (`unknown_outcome`) sin más llamadas para esa fila. El texto enviado en un reintento es idéntico al primero. Dos despachos concurrentes sobre las mismas filas (test con base) llaman al publicador una vez por fila.
- **CA-6 Caducidad y topes.** Dada una fila abierta cuya Decision tiene `decided_at` anterior a `now` − 10 min: si está `pending` queda `expired`; si está `sending` queda `failed` (`unknown_outcome`); en ningún caso se llama al publicador. Con 6 filas publicables, un despacho hace 4 llamadas y deja 2 `pending`. Una llamada que no responde en 5 s cuenta como `unknown` (test con reloj falso).
- **CA-7 Qué no sale.** Antes de llamar al publicador, y sin contar para el tope: una fila cuyo equipo (el de su `side`) no está vigilado queda `skipped` (`not_watched`), sin texto; un `goal_annulled` queda `skipped` (`goal_not_posted`) salvo que el último `goal` del mismo partido y lado esté `sent` (o, en modo seco, `skipped` por `disabled`).
- **CA-8 Plantillas.** `src/i18n/social.gl.ts` exporta ≥ 5 plantillas `goal` y ≥ 3 `goal_annulled`, en galego, con `id` estable. Test sobre todas: el texto lleva `Team.name` de los dos equipos sin truncar (D-2) y el marcador; `{team}` nunca va tras una contracción (`do`, `da`, `ao`, `á`, `no`, `na`), porque el género de los nombres federativos varía; no contiene `@`; el minuto sale como en la pantalla (`45+2'`) y, si es nulo, no deja `null`, comilla suelta ni línea vacía; con los nombres más largos de `data/calendario/2026-27/` y la ligazón, ≤ 250 caracteres.
- **CA-9 Selector.** `pickTemplate(candidates, excluded, rng)` es puro. El despacho excluye la plantilla del último texto del mismo `kind` de ese equipo y la del último de la cuenta. Test: con RNG de semilla fija el resultado es determinista; en 1.000 tiradas nunca sale una excluida y salen todas las demás.
- **CA-10 Configuración y modo seco.** `socialConfig(env)` es puro. Test de tabla: `SOCIAL_PUBLISHER` solo vale si es un id del registro de publicadores (vacío en esta spec); cualquier otro valor o su ausencia = apagado. `SOCIAL_WATCHED_TEAMS` = ids separados por comas, recortados; vacía o ausente = los ids de `data/galegos/<temporada del partido>.json`. `SOCIAL_LINK_URL` solo vale si es `https://marcador.gal` o una ruta suya; si vale, va como última línea del texto. Apagado: las filas vigiladas quedan `skipped` (`disabled`) **con** `text` y `template_id`, y el doble no recibe ninguna llamada. `.env.example` documenta las tres.
- **CA-11 Enganche.** La ruta del tick llama al despacho después del barrido en **todo** tick: dado un tick sin partidos en ventana y una fila `pending` caducada, la fila queda `expired`. Si el despacho lanza, el tick responde 200, el resumen lleva `socialError` y las Decisions del tick están escritas. El resumen gana los contadores `social` (`sent`, `failed`, `retried`, `expired`, `skipped`). `npm run ingest:tick` no despacha.
- **CA-12 Fronteras y gates.** Test en `src/arch/`: `src/social/**` no importa `src/decide`, `src/sources` ni `src/ingest`, y ninguno de ellos importa `src/social`. `src/decide/` sin cambios (`git diff --stat`). `npm run gates` y `npm run test:db` en verde. Versión `minor` (ADR-028).

## Entidades y reglas afectadas
ADR-030 (toda la spec). Decision, Match, Team, Equipo galego, Tick (`dominio.md`). RN-03 y ADR-011 (quién baja un marcador), RN-07 (no aplica: tabla de operación), ADR-019 §1-§2, ADR-022 §2, ADR-025 §4, ADR-016, ADR-008 §5-§7, D-2, D-6, D-9.

## Fuera de alcance
Cliente de Buffer, clave, sonda y encendido (SPEC-067). Jornada medida de los criterios 1, 2 y 4 de la épica (spec posterior, sin escribir). Comprobar que un `sent` llegó a X. Tope diario propio. Nombre del goleador. Alertas al operador.

## Notas para el gate humano
- **Corte en dos specs.** SPEC-066 no depende de ninguna cuenta ni de la red y se verifica entera hoy; SPEC-067 junta todo lo que espera al titular y a Buffer.
- **H-1 ¿Goles encajados?** Esta spec publica solo los goles **que marca** el equipo vigilado (letra de la épica). La alternativa, todo gol de un partido con un equipo vigilado, sube el volumen en torno a un 40 % (estimación sin medir). *Recomendación:* dejarlo así hasta conocer el tope diario real de X (SPEC-067). *Resuelta 2026-11-09 por el titular: aceptada.*
- **H-2 Gol que nace `provisional`.** Si se confirma después con el mismo marcador, no se publica. *Recomendación:* aceptar; hoy la única fuente activa decide `confirmado`. *Resuelta 2026-11-09 por el titular: aceptada.*
- **H-3 Anulación.** Se publica aunque la Decision que baja no sea `confirmado`, y solo si el gol salió. *Recomendación:* aceptar. *Resuelta 2026-11-09 por el titular: aceptada.*
- **H-4 Sin respuesta no se reintenta.** Se pierde el tweet antes que duplicarlo. *Recomendación:* aceptar hasta que SPEC-067 mida cómo tratan Buffer y X un duplicado exacto. *Resuelta 2026-11-09 por el titular: aceptada.*
- **H-5 Textos.** Los redacta el implementador; el titular los revisa en el PR y, ya en seco, en `social_posts`.
