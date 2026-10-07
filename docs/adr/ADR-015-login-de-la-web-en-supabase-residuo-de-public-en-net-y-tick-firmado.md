---
id: ADR-015
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-07, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-015: Login de la web en Supabase: residuo de PUBLIC en net y tick firmado

- Deciders: sdd-arquitecto propone (2026-10-07) por V-1 del verificador de SPEC-020. Alberto Fojo decide H-1..H-3 el 2026-10-07, las tres con la recomendación del arquitecto.
- Specs relacionadas: SPEC-020 (CA-2, CA-9). **Precisa ADR-014 §4** («`SELECT` solo sobre ella») y **ADR-008 §1** (autenticación del disparador pg_cron). No cambia nada más de ambos.

## Contexto

En Supabase todo rol es miembro de PUBLIC, y pg_net (0.20.4 en la imagen
local) da a PUBLIC, con `supabase_admin` como otorgante: `USAGE` en `net`,
`arwdDxtm` en `net.http_request_queue` y `net._http_response`, `rwU` en su
secuencia y `EXECUTE` en las funciones de `net` sin ACL propia (`http_delete`,
`worker_restart`, `wake`…; `http_get`/`http_post` sí están cerradas). `postgres`
no es superusuario: `REVOKE … FROM public` → «no privileges could be revoked».
Comprobado en local (transacciones con rollback): como `web_reader`,
`net.http_delete('http://example.invalid/…')` encola la petición; `vault`,
`cron`, `extensions`, `storage` y `public.matches` → 42501. `anon` y
`authenticated` tienen lo mismo en `net`, pero no son de login y la Data API
no expone `net`. El job `ingest-tick` deja en la cola `Bearer
<INGEST_TICK_TOKEN>`: con `DATABASE_URL_PUBLIC` filtrada se leería.

## Decisión

1. **Se mantiene `web_reader` (ADR-014 §4) con un residuo cerrado y
   nombrado**: lo que PUBLIC tiene en `net` (arriba) y nada más. «`SELECT` solo
   sobre `web.xornada`» se lee como «solo eso, más este residuo». (H-1)
   *2026-10-07, ampliado por el titular (F-SPEC-020-11):* el residuo incluye
   también lo que PUBLIC ejecuta en `pg_catalog` y `postgres` no puede revocar
   (large objects propios, advisory locks, `pg_notify`, `pg_logical_emit_message`)
   y `CONNECT`/`TEMP` en las otras bases de Supabase. Ninguno da datos ni
   escritura en tablas; `TEMP` en la base del proyecto sí se revoca. El riesgo
   de retener el lock de `openAttempt` se blinda en una spec de EPIC-MANT.
2. **Ningún secreto reutilizable en la cola.** El job de pg_cron envía
   `Authorization: Bearer t1.<epoch>.<firma>`, con `<epoch>` en segundos UTC
   de `now()` y `<firma>` = HMAC-SHA256 en hex minúsculas de `t1.<epoch>` con la
   llave de Vault `ingest_tick_token` (pgcrypto); la llave no sale de Vault.
   `authorizeTick` recibe `now` de la ruta (ADR-008 §7) y acepta el bearer
   estático (Vercel Cron, `tick:salud`: nunca pasa por la base) o una firma
   válida con `|now − epoch| ≤ 60 s`, comparada con `timingSafeEqual`. Una
   firma robada vale como mucho un minuto de ticks, que RN-08 (ADR-008 §3) ya
   absorbe. (H-2)
3. **Inventario cerrado en test.** Un test de base recorre todos los esquemas
   salvo `pg_catalog` e `information_schema` con `has_schema_privilege`,
   `has_table_privilege`, `has_sequence_privilege` y `has_function_privilege`
   (funciones invocables: no las que devuelven `trigger`) y falla con
   cualquier privilegio alcanzable por `web_reader` fuera de `SELECT` en
   `web.xornada` y del residuo de §1. Si una subida de pg_net o de la imagen lo
   amplía, el test rompe y se vuelve a este ADR.
4. **Respuesta a una filtración**: rotar con `npm run db:web-reader`. Lo que
   queda expuesto entretanto es solo el residuo: peticiones HTTP salientes desde
   la base (SSRF), vaciar o llenar la cola y reiniciar el worker (cae el
   disparador de 30 s; Vercel Cron sigue cada minuto). Nunca el log, escribir
   en tablas ni leer secretos.

## Consecuencias

### Positivas
La web sigue sin poder leer el log ni escribir, sin dependencias ni claves
nuevas. El token del tick deja de estar en una tabla legible por cualquier login.

### Negativas / follow-ups
Residuo aceptado mientras Supabase no cierre PUBLIC en `net` (follow-up: pedir
a soporte que lo revoque; no es un control nuestro). El titular comprueba en
producción que `net` no está en «Exposed schemas» de la Data API. Reloj de la
base y de Vercel a menos de 60 s (NTP en ambos).

## Alternativas consideradas

- **Data API con la clave anon/publishable y `web` expuesto**: la clave va al
  navegador (ADR-014 §5): cualquiera consultaría la vista sin caché ni límite y
  todas las temporadas. Reabre lo que ADR-014 §2 cerró y cambia un riesgo
  condicionado a una filtración por uno incondicional; además «Exposed
  schemas» es configuración del dashboard, fuera de migraciones.
- **Data API con rol propio y JWT firmado en el servidor**: mejor contención
  (filtrado, solo lee la vista), pero exige firmar con el secreto JWT legado o
  importar una clave de firma, `grant … to authenticator`, exponer `web` en el
  dashboard y un cliente HTTP. Operación de claves desproporcionada con un
  operador; queda como salida si H-1 = no.
- **Quitar pg_net** (`drop extension pg_net` funciona como `postgres` en
  local): elimina el residuo, pero también el disparador de 30 s (ADR-002 §1);
  sustituirlo cambia cadencia, coste y redundancia. Spec propia si se quiere.
- **SECURITY DEFINER, otro rol de login, `default_transaction_read_only`**: no
  sirven; quien conecta es miembro de PUBLIC y el cliente puede deshacer el
  `SET`.
- **Token de un solo uso en tabla**: mismo efecto que §2 con estado y una
  consulta más en la autenticación.

## Para el titular (resuelto el 2026-10-07 por Alberto Fojo)

- **H-1** ¿Se acepta el residuo de §1 para `web_reader` con §2-§4? Recomendado: sí.
- **H-2** ¿Firma con ventana de 60 s para pg_cron, dentro de SPEC-020 (CA-9)
  porque bloquea el despliegue? Recomendado: sí.
- **H-3** ¿Los previews conservan `DATABASE_URL_PUBLIC` (ADR-014 H-3)? Quitarla
  reduce dónde puede filtrarse, no el residuo. Recomendado: sí, se conserva.
- **Resueltas (Alberto Fojo, 2026-10-07):** H-1 = sí, H-2 = sí, H-3 = sí.
- **H-4 (Alberto Fojo, 2026-10-07):** residuo ampliado de §1 (F-SPEC-020-11) = sí, con spec de EPIC-MANT para blindar el advisory lock de `openAttempt`.
