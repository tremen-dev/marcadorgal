---
id: ADR-007
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-21, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-007: Raw store en Supabase Storage: bucket, claves, escritura y retención

- Deciders: sdd-arquitecto propone (2026-09-21); Alberto Fojo fija en el gate de SPEC-006 (2026-09-21) las alternativas abiertas (ver Decisión); aprobación formal pendiente.
- Specs relacionadas: SPEC-006 (origen); las specs c y d de EPIC-002 (motor y despliegue) y EPIC-004 (operador lee crudo) lo consumen.

## Contexto

D-6 y RN-09 exigen guardar la respuesta cruda antes de parsearla y que toda
Observation la referencie. ADR-002 §4 decide «crudo en Supabase Storage, no en
Postgres, con retención automática de 30 días», pero no dice cómo se escribe,
qué es un objeto, cómo se nombra ni quién borra. ADR-001 restringe
`supabase-js` al cliente. Tamaño medido (SPEC-005 F-5): 15 partidos de
`ids=` = 198 KB; un sábado con ~1.000 ticks en ventana y 2-3 peticiones por
tick supera 1 GB al mes sin comprimir, que es el límite de Storage en el plan
Free de `dev`. Supabase Storage no tiene reglas de ciclo de vida, y borrar filas
de `storage.objects` con SQL deja los ficheros huérfanos en el almacén.

## Decisión

1. **Bucket privado `raw`**, creado por migración SQL (`storage.buckets`), sin
   política alguna en `storage.objects`: `anon` y `authenticated` no ven nada;
   solo el servidor con la clave de servicio.
2. **Un objeto por captura**: el `RawCapture` entero (todas sus `requests`)
   serializado a JSON y comprimido con gzip (`application/gzip`). Clave
   `<sourceId>/<YYYY-MM-DD>/<capturedAt sin ':'>-<attemptId>.json.gz`; el día
   sale de `capturedAt` (UTC).
3. **`raw_ref` = `raw/<clave>`** (bucket + clave, autodescriptivo). Es lo que
   llevan `observations.raw_ref`, `ingest_attempts.raw_ref` y
   `alerts.details.rawRef`. Nunca se rehidrata a Postgres.
4. **Escritura y borrado por la API REST de Storage con `fetch`** y
   `SUPABASE_SERVICE_ROLE_KEY`, solo desde el servidor, sin `supabase-js`
   (ADR-001). Detrás de una interfaz `RawStore` (`put`, `get`, `remove`) en
   `src/raw/`, con implementación en memoria para tests.
5. **Retención de 30 días ejecutada por el propio tick** (decidido en el gate frente a endpoint + job diario): como mucho una vez
   cada 24 h (tabla `raw_purges`), selecciona claves de `storage.objects` con
   `created_at` anterior a 30 días, en lotes de 1.000, y las borra **por la
   API** (nunca `delete from storage.objects`). Un fallo se anota y se
   reintenta al cabo de 1 h; nunca detiene la ingesta.
6. **Crudo antes que parseo, en sentido fuerte**: si `put` falla, el intento
   falla y no se parsea nada. Perder el crudo pasado los 30 días no rompe nada:
   la referencia sigue en el log; el operador ve «captura expirada».

## Consecuencias

### Positivas
Sin dependencias nuevas ni segundo cliente. Tamaño: JSON del proveedor
comprime ~10:1; ~20-30 MB por día de jornada, < 1 GB en 30 días en Free.
Retención sin job externo: en cuanto el tick corre, corre la retención. Un
objeto por captura mantiene junto lo que `parse` vio junto.

### Negativas / follow-ups
Una llamada HTTP más por intento (~100 ms) antes de parsear. La purga lee el
esquema `storage` desde `postgres.js`: si Supabase lo cambia, se ajusta la
consulta. Sin lectura del crudo en EPIC-002: el operador la tendrá en EPIC-004.

## Alternativas consideradas

- **`jsonb`/`bytea` en Postgres**: descartado en ADR-002 §4 (tamaño, coste).
- **`@supabase/supabase-js` o `@supabase/storage-js` en servidor**: contradice
  ADR-001 por una llamada `PUT` y una `DELETE`.
- **Protocolo S3 con AWS SDK**: dependencia pesada para lo mismo.
- **pg_cron borrando `storage.objects`**: deja huérfanos en el almacén.
- **Un objeto por petición HTTP**: triplica objetos y purga; `parse` recibe la
  captura entera, así que se guarda entera.
- **Sin compresión**: ~10× espacio; agota el plan Free en dos fines de semana.
- **Retención más corta o configurable por entorno**: 30 días es la promesa de
  D-6/dominio.md; la compresión hace innecesario acortarla. El límite de 1 GB
  de `dev` (Free) se vigila a mano en la primera jornada (gate de SPEC-006).
- **Endpoint de purga + job diario de pg_cron**: retención dependiente de un
  segundo job; rechazado en el gate a favor de la purga dentro del tick.
