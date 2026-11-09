---
id: SPEC-067
tipo: spec
epica: EPIC-007
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-11-09, por: sdd-arquitecto}
---
# SPEC-067 — Publicador de Buffer: cliente GraphQL, sonda contra la API real y encendido

## Problema
SPEC-066 deja los goles redactados y sin salir (modo seco). Falta la implementación del puerto `SocialPublisher` contra Buffer (ADR-030 §5) y encenderla. De la API de Buffer hay tres cosas sin verificar (2026-11-08): si `createPost` admite `mode: shareNow`, cuánto tarda un post en aparecer en X, y el tope diario de X (su soporte dice 50 y 100). Se miden con una cuenta real antes de escribir el cliente definitivo: crudo antes que parseo también aquí. Depende de SPEC-066 en `hecho` y desplegada.

## Usuarios / roles afectados
- Seguidores de la cuenta de X: empiezan a recibir los goles.
- Titular: crea la cuenta de Buffer, conecta X, custodia la clave y enciende o apaga.

## Criterios de aceptación
- **CA-1 Sonda.** `npm run social:probar` usa el mismo cliente que producción, con `BUFFER_API_KEY` y `BUFFER_CHANNEL_ID` del entorno local. `--limites` consulta `dailyPostingLimits`; `--publicar "<texto>" [--modo <modo>]` llama a `createPost`; `--guardar <nombre>` escribe la respuesta cruda en `src/social/buffer/fixtures/`. Imprime estado HTTP, cuerpo y milisegundos. La clave no aparece en la salida ni en la fixture (test con una clave centinela). Sin las variables sale 1 y lo dice.
- **CA-2 Validación contra la API real.** Manual, en el canal de pruebas (H-2). El ledger lleva, con sus fixtures: (a) si `createPost` acepta `mode: shareNow`; si no, qué pasa con `customScheduled` (`dueAt` = ahora) y con `addToQueue`; (b) 5 posts con el modo elegido: segundos entre la petición y la hora del tweet en X, mediana y máximo; (c) el `limit` de `dailyPostingLimits` para el canal; (d) el mismo texto dos veces: qué responde `createPost` y qué aparece en X; (e) estado y cuerpo con una clave inválida; (f) el tiempo de respuesta más alto de `createPost`. **Parada:** si ningún modo da una mediana ≤ 30 s en (b) (criterio 2 de la épica), o (f) pasa de 2,5 s (la mitad del timeout de ADR-030 §4), la spec se detiene y vuelve al titular con los datos.
- **CA-3 Cliente.** `src/social/buffer/` implementa `SocialPublisher` con `fetch` inyectado: `POST https://api.buffer.com`, `Authorization: Bearer`, mutación `createPost` con `text`, `channelId`, `schedulingType: automatic` y el modo fijado en CA-2. Test sobre las fixtures de CA-2, sin red: `PostActionSuccess` → `sent` con `post.id`; `MutationError` → `rejected` con su `message` en una línea; 429 → `retry` con su `Retry-After`; 5xx → `retry`; 401, 403 y demás 4xx → `rejected`; abort, error de red o cuerpo que no es el JSON esperado → `unknown`. Ningún resultado contiene la clave.
- **CA-4 Cableado.** El registro de publicadores gana `buffer`. Test de tabla: `SOCIAL_PUBLISHER=buffer` con clave y canal → el despacho usa el cliente; `buffer` sin clave o sin canal → se comporta como apagado, el resumen del tick lleva `socialError` `unconfigured` y nada lanza. `.env.example` documenta `BUFFER_API_KEY` y `BUFFER_CHANNEL_ID` (solo Production).
- **CA-5 Presupuesto de peticiones.** Dado un despacho con el `fetch` doble, entonces recibe una petición por intento y ninguna más: ni `dailyPostingLimits` ni consultas de estado dentro del tick (1.000 peticiones por canal y 30 días).
- **CA-6 Ensayo en seco.** Antes de encender, una jornada real con SPEC-066 desplegada. El ledger lleva la consulta de `social_posts` de esa jornada: las filas `goal` de equipos vigilados coinciden una a una con las subidas en `live` de `decisions` para esos equipos, ninguna `(decision_id, side)` repetida, y el visto bueno del titular a los textos (SPEC-066 H-5).
- **CA-7 Encendido.** Manual, por el titular (H-1, H-3, H-4), con CA-2 y CA-6 cerrados. `vercel env ls` muestra `SOCIAL_PUBLISHER`, `BUFFER_API_KEY` y `BUFFER_CHANNEL_ID` solo en Production. Evidencia en el ledger: la primera fila `sent` con su `provider_post_id` y la URL del tweet; y el simulacro de apagado: sin `SOCIAL_PUBLISHER` y tras un redeploy, la siguiente fila vigilada queda `skipped` (`disabled`).
- **CA-8 Gates.** `npm run gates` en verde, el test de fronteras de SPEC-066 CA-12 sigue verde con `src/social/buffer/`, y versión `minor` (ADR-028).

## Entidades y reglas afectadas
ADR-030 §4-§5, §7-§8. SPEC-066 (puerto, despacho, modo seco). D-7 (por analogía: cuenta y clave son del titular), D-9. Fuentes, todas del 2026-11-08: `buffer.com/pricing`, `developers.buffer.com/guides/api-limits.html`, `/guides/posts-and-scheduling.html`, `/reference.html`, `support.buffer.com/articles/using-xtwitter-with-buffer-nA84XnWtuU`, `docs.x.com/developer-guidelines`.

## Fuera de alcance
Jornada medida de los criterios 1, 2 y 4 de la épica (spec siguiente, sin escribir: compara `social_posts` con los tweets de la cuenta). Cliente de la X API (reserva). Consultar después si X publicó cada post. Tope diario propio. Imágenes, hilos, respuestas.

## Notas para el gate humano
- **H-1 Cuenta de Buffer.** El titular crea la cuenta (plan Free), conecta la cuenta de X de marcador.gal y genera la clave en `publish.buffer.com/settings/api`. Sin esto no arranca CA-2. *Cuenta Free creada por el titular el 2026-11-09; falta conectar X y generar la clave.*
- **H-2 Canal de pruebas.** *Recomendación:* una segunda cuenta de X, protegida, como segundo canal del mismo Buffer (Free admite 3): los tweets de prueba no los ve nadie y los límites son por canal. La alternativa es probar en la cuenta real y borrar. *Resuelta 2026-11-09 por el titular: segunda cuenta de X protegida como canal de pruebas.*
- **H-3 Normas de X.** Antes de CA-7, la cuenta lleva la etiqueta «Automated» (pide una cuenta humana asociada) y una bio que dice quién la opera. Las plantillas no llevan `@` ni se repiten idénticas (SPEC-066 CA-8, CA-9).
- **H-4 Custodia de la clave.** *Recomendación:* la sonda de CA-2 la ejecuta el titular, o el implementador con la clave en un `.env.local` sin versionar; en Vercel, solo en Production.
- **H-5 Si el tope resulta ser 50 posts en 24 h.** *Recomendación:* encender igual y medirlo en la jornada; la lista de equipos vigilados recorta sin tocar código. *Resuelta 2026-11-09 por el titular: aceptada.*
- **N-1** `sent` es «Buffer lo aceptó». Que X lo publicó se comprueba a ojo en CA-7 y con números en la jornada medida.
- **N-2** Si CA-2 se detiene, la salida es la reserva de ADR-030 §5 (X API, 0,015 $ por post sin ligazón) y una spec nueva; no se fuerza Buffer.
