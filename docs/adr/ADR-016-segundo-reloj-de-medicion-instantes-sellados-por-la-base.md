---
id: ADR-016
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-09, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-016: Segundo reloj de medición: instantes sellados por la base

- Deciders: sdd-arquitecto propone (2026-10-09) para R-SPEC-009-7 y el criterio 3 de EPIC-003; aprobación pendiente de Alberto Fojo en el gate de SPEC-025.
- Specs relacionadas: SPEC-025 (lo implementa). Precisa ADR-008 §7 sin supersederlo. No toca ADR-014 §3 (`PublicMatch`).

## Contexto

Hoy todo instante del camino del dato sale de un único `now` que pone la ruta
del tick antes de pedir al proveedor (ADR-008 §7): `observed_at`, `received_at`,
`decided_at`, `started_at` y `finished_at` de `ingest_attempts`. SPEC-009 midió
3317 de 3350 Decisions con `decided_at = observed_at` al milisegundo: la
latencia interna es cero por construcción (N-10, R-SPEC-009-7). Para desglosar
gol → pantalla hace falta un segundo reloj, sin que el núcleo lea la hora ni
cambie lo que significan los instantes que ya usan el motor y la ventana.

## Decisión

1. **El segundo reloj es el de Postgres**, sellado por defecto de columna con
   `clock_timestamp()` (instante real de la sentencia, no el de la
   transacción). El código no lo escribe ni lo lee para decidir: ADR-008 §7
   sigue intacto («nada bajo `src/ingest/` ni `src/raw/` consulta el reloj»).
2. **Dos columnas nuevas, solo de medición**: `ingest_attempts.opened_at`
   (alta del intento, justo antes del `fetch`) y `decisions.recorded_at`
   (inserción de la Decision). Nulables; se añaden **sin** valor por defecto y
   después `set default clock_timestamp()`, para no reescribir las tablas ni
   dar a las filas históricas un instante falso (quedan `null`).
3. **Tercer punto existente**: `storage.objects.created_at` del `raw_ref`
   (crudo guardado, tras la respuesta del proveedor), leído solo en lectura,
   como la purga de ADR-007 §5.
4. **Fuera del modelo y de lo público**: ni en los esquemas zod (`Observation`,
   `Decision`), ni en `web.xornada`, ni en el payload de Realtime. Solo las
   leen las consultas de medición. `src/decide` no las ve.
5. **Los relojes no se mezclan (D-9)**: cada tramo se mide dentro de un reloj.
   Restar entre relojes (referencia ↔ tick, base ↔ navegador) solo se hace en
   juntas declaradas, y el informe imprime el desfase estimado de cada una.

## Consecuencias

### Positivas
Desglose captura → Decision en un solo reloj sin tocar motor, ventana ni
contrato de fuentes. Tests deterministas como hoy. Coste: dos `timestamptz`
por fila.

### Negativas / follow-ups
Una migración en producción (la única base remota, ADR-014 §1); compatible:
el código desplegado no nombra las columnas. Las filas anteriores no se
desglosan. Si un día se mide con otra base o réplica, su reloj es otro.

## Alternativas consideradas

- **Inyectar una función reloj en el tick**: rompe ADR-008 §7 y la
  determinación de los tests del núcleo.
- **Sellar `capturedAt` tras la respuesta**: cambia `observed_at` (RN-11), que
  usan la ventana y el motor; mediría cambiando lo medido.
- **Dejar actuar el `default now()` de `received_at`**: el núcleo lo
  sobrescribe y `window.ts` lo usa para la prórroga; además `now()` es el de la
  transacción, no el de la sentencia.
- **Logs de Vercel**: retención corta, sin estructura y en otro reloj.

- **Aprobado por el titular (Alberto Fojo, 2026-10-09)** junto con SPEC-025 y SPEC-026.
