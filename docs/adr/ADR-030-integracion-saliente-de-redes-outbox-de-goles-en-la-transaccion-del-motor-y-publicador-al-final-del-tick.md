---
id: ADR-030
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-09, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-030: Integración saliente de redes: outbox de goles en la transacción del motor y publicador al final del tick

- Deciders: sdd-arquitecto propone (2026-11-09) a encargo del orquestador para EPIC-007. **Alberto Fojo (titular) fijó antes, el 2026-11-09:** publicar por Buffer (plan Free, API) con la X API de pago por uso como reserva y sin automatización por navegador; H-1..H-4 de la épica; configuración que se cambie sin desplegar código. Pendiente de aprobación en el gate de SPEC-066.
- Specs relacionadas: SPEC-066 (detección, outbox, publicador con doble) y SPEC-067 (Buffer) lo implementan. **Precisa, sin superseder:** ADR-019 §2 y ADR-009 §6 (el adaptador del motor escribe, además de Decisions y alertas, la fila de §2), ADR-008 §6 (tercer enganche del tick) y ADR-002 §8 (un outbox en Postgres no es una cola que operar). Reutiliza la regla de ADR-022 §2 y el reloj de ADR-016.

## Contexto
EPIC-007 pide un tweet por gol en directo de un equipo vigilado, uno solo aunque pg_cron (30 s) y Vercel Cron (1 min) se solapen, y que un fallo de Buffer o de X no toque el marcador. Hoy «gol» no existe como dato: es la diferencia entre dos Decisions consecutivas, calculada al leer en `web.xornada` (ADR-022). El único sitio que tiene las dos en la mano, bajo el cerrojo de ADR-019, es `decideLocked` (`src/ingest/engine.ts`). Buffer (verificado el 2026-11-08 en `developers.buffer.com/guides/api-limits.html` y `/guides/posts-and-scheduling.html`): GraphQL en `api.buffer.com`, `createPost` devuelve `PostActionSuccess` o `MutationError`, 1.000 peticiones por canal y 30 días, 429 con `Retry-After`. **Sin verificar:** que `shareNow` sea modo de entrada, la latencia real y el tope diario de X (50 o 100).

## Decisión
1. **El gol se detecta en el adaptador del motor.** `decideLocked` compara, por lado, la Decision vigente con la que va a insertar. Las dos `live`, el marcador del lado sube y la nueva es `confirmado` → `goal`. Las dos `live` y baja → `goal_annulled`, con cualquier cualificador: una corrección no se calla. Nunca en `decideRecovered` (ADR-025 §4) ni en `replay:jornada --aplicar` (ADR-019 §6): solo en directo. `src/decide/` no cambia.
2. **Outbox `social_posts`**: una fila por (Decision, lado), con restricción única, escrita en la misma transacción que la Decision y dentro de un savepoint: si la fila falla, la Decision se escribe igual. Guarda `decision_id` (D-6) y no copia marcador ni nombres: el texto sale de la Decision, que es inmutable. Es tabla de operación, mutable como `alerts`, con RLS sin políticas y fuera del alcance de `web_reader` (ADR-014 §2, ADR-015 §3). La detección no lee configuración: registra todo gol de todo partido; filtrar es cosa del publicador.
3. **Publicador al final de cada tick**, tercer enganche tras el barrido, fuera de toda transacción del motor y también en un tick sin ventana. Su fallo queda en el resumen del tick y en la fila; no abre alertas ni toca Decisions (D-9). Va fila a fila, por orden de creación: la reclama con `for update skip locked` en una transacción corta (pasa a `sending`, con el texto ya fijado), llama al proveedor fuera de transacción y anota el resultado.
4. **Resultados y reintentos.** Aceptado → `sent` con el id del proveedor. Rechazo con respuesta (error de la mutación, 4xx) → `failed`. 429 o 5xx → vuelve a `pending` y el publicador para hasta el tick siguiente; máximo 3 intentos. **Sin respuesta (timeout, red) → `failed` sin reintento:** no se sabe si salió, y un duplicado es peor que un tweet perdido. Caducidad con el `now` del tick (ADR-008 §7): una fila cuya Decision tiene más de 10 min pasa a `expired`. Tope: 4 posts por tick y 5 s por petición (20 de los 60 s del tick). Una petición por intento y ninguna consulta de sondeo: como mucho 3 por gol.
5. **Puerto `SocialPublisher`** en `src/social/`: publicar un texto devuelve uno de cuatro resultados (`sent`, `rejected`, `retry`, `unknown`). Implementaciones: Buffer (SPEC-067), un doble en memoria y, en reserva y sin escribir, la X API. `src/social/` importa de `src/model` y `src/i18n`; no importa `src/decide`, `src/sources` ni `src/ingest`, ni ellos a él. Se tocan en la tabla y en la ruta del tick, que cablea. Lo comprueba un test de arquitectura.
6. **El texto se fija una vez.** La plantilla se elige al reclamar la fila por primera vez, con un selector puro de RNG inyectado, y se guarda en la fila; un reintento reenvía el mismo texto. Las plantillas viven en `src/i18n/social.gl.ts`, fuera de `Dictionary`: la cuenta solo publica en galego (D-2).
7. **Configuración por variables de entorno de Vercel**, leídas en la ruta del tick por un parser puro y tolerante: `SOCIAL_PUBLISHER` (ausente o desconocida = apagado), `SOCIAL_WATCHED_TEAMS` (vacía = los de `data/galegos/<temporada>.json`) y `SOCIAL_LINK_URL` (vacía = sin ligazón). Apagado es **modo seco**: las filas se redactan y terminan `skipped` sin llamar a nadie. Cambiar una variable es un redeploy del mismo commit, sin PR ni versión (precedente: SPEC-042). El corte inmediato, sin redeploy, es pausar o desconectar el canal en Buffer.
8. **Secretos**: `BUFFER_API_KEY` y `BUFFER_CHANNEL_ID`, solo en Production. La cuenta y la clave las crea y custodia el titular (como D-7). Nunca en base, log, fixture ni mensaje de error.
9. **Medición**: `created_at` y `closed_at` de la fila los sella Postgres con `clock_timestamp()` (ADR-016); el código no los lee para decidir.
10. **Letras nuevas** (`dominio.md`, al aprobarse). **Publicación en redes**: «lo que la cuenta de una red dice de una Decision: una fila de `social_posts` con su Decision, su texto y su resultado. La escribe el adaptador del motor y la despacha el publicador; nunca cambia una Decision». **Tick** gana «y, al final, despacha las publicaciones en redes pendientes».

## Consecuencias
### Positivas
Una fila por gol por construcción (cerrojo de ADR-019 más restricción única): dos ticks solapados no duplican. Cada tweet lleva a su Decision, sus Observations y su crudo. El modo seco ensaya una jornada entera sin cuenta. Cambiar de proveedor es escribir otra implementación del puerto.
### Negativas / follow-ups
- `sent` significa «aceptado por Buffer», no «publicado en X»: lo contrasta la jornada medida.
- Un gol que nace `provisional` y se confirma después con el mismo marcador no se publica (regla por pares, como ADR-022). Hoy no ocurre: la única fuente activa decide `confirmado`.
- Un timeout pierde el tweet. Un cambio de variable tarda un redeploy (~2 min, con su Deployment Check).
- Se registran los goles de las cinco competiciones, vigilados o no.
- En la reserva, la ligazón multiplica el coste por 13 (0,015 $ → 0,20 $ por post; `docs.x.com/x-api/getting-started/pricing.md`, 2026-11-08).

## Alternativas consideradas
- **Trigger en `decisions` + pg_net hacia Buffer**: plantillas, reintentos y configuración en PL/pgSQL, y la clave viajaría por `net.http_request_queue`, que `web_reader` puede leer (residuo de ADR-015 §1).
- **Llamar a Buffer dentro de la transacción del motor**: red bajo el cerrojo del partido (ADR-019 no tiene `lock_timeout`), y un fallo de Buffer desharía Observations y Decision.
- **Sin outbox, derivando los goles al leer** (como ADR-022): no hay dónde anotar qué salió, así que ni «solo uno» ni reintentos.
- **Fichero en `data/` o tabla de configuración en vez de variables**: el fichero queda versionado, pero cada cambio es PR, versión y despliegue (contra el criterio 6 de la épica). La tabla es inmediata, pero sin panel de operador (EPIC-005) es SQL a mano en producción y sin validar; se revisa con el panel.
- **X API directa como vía principal**: de pago y con credenciales de desarrollador. Queda detrás del puerto como reserva.
- **Navegador o clientes con cookies**: lo prohíben las normas de X (`docs.x.com/developer-guidelines`); suspensión permanente.
- **Servicio de colas o cron propio para publicar**: otra pieza que operar (ADR-002 §8); el tick ya pasa cada 30 s.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
