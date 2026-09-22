---
id: EPIC-MANT
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-producto}
---
# EPIC-MANT — Mantenimiento

## Objetivo

Cubo permanente para el trabajo que no entrega capacidad nueva pero evita que
la existente se pudra: fallos silenciosos, deuda que ya mordió una vez,
observaciones de verificación que no bloqueaban su spec. No tiene fecha de
cierre ni compite por prioridad con las épicas de producto; se vacía cuando
algo de dentro se vuelve urgente o cuando hay hueco entre épicas.

Existe porque sin él estas cosas se anotan en el ledger de una spec cerrada y
mueren ahí: nadie relee el ledger de una spec en `hecho`.

## Criterios de éxito

1. Toda observación que sobrevive a una verificación sin bloquearla tiene un
   destino explícito: se arregla en su spec, se descarta con razón escrita, o
   entra aquí. Ninguna se queda solo en el ledger de una spec cerrada.
2. Nada que esté aquí es un fallo que ya esté haciendo daño en producción: eso
   es EPIC-FIX y salta la cola.

## Alcance

- Dentro: fallos silenciosos que aún no han mordido; deuda técnica con un modo
  de fallo concreto y escrito; observaciones de verificación no bloqueantes;
  arreglos de tooling, workflows y scripts.
- Fuera (aparcado a propósito, no por descuido): fallos activos en producción
  (EPIC-FIX); mejoras de producto y capacidad nueva (su épica); refactores sin
  un modo de fallo concreto detrás, que son gusto y no mantenimiento.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

Pendientes de especificar, con su procedencia:

- **M-1 — `git status` fallido se lee como «no hay cambios»** en el workflow
  `calendario-semanal.yml`. El paso «¿Hay diff en el calendario declarado?»
  decide con `if [ -z "$(git status --porcelain …)" ]`: si el comando fallara,
  la sustitución sale vacía y el workflow concluye que no hay nada que
  sincronizar. Mismo género de silencio que O-2 de SPEC-008 —el `tee` que se
  tragaba el estado de salida— pero sin tubería, así que `shell: bash` no lo
  alcanza: ni `-e` ni `pipefail` cubren una sustitución dentro de `[`.
  Procedencia: observación del implementador de SPEC-008, 2026-09-21. No
  bloqueaba su spec. El workflow corre los martes.
- **M-2 — cota de lotes en `purgeRaw`.** Observación del verificador de
  SPEC-006; no ha aparecido en la práctica.
- **M-3 — lector de YAML propio en `src/arch/deploy.test.ts`.** ~70 líneas
  escritas para evitar una dependencia (verificado que no había alternativa en
  Node 26 ni en el lock). Sobra el día que entre una librería de YAML al
  proyecto. Procedencia: SPEC-008 O-1.
- **M-4 — `sql.array` en `src/ingest/engine.ts`.** Tres apariciones de `sql.array`
  en las consultas de `decideMatches` (CA-4 de SPEC-008). Hoy se salvan porque
  `decideMatches` siempre corre dentro de una transacción ya abierta (`src/app/api/ingest/tick/route.ts`
  L78: `db.transaction`), así que el mapa de tipos de postgres.js está caliente.
  Fuera de transacción fallan en frío con `PostgresError: op ANY/ALL (array) requires array on right side`.
  Modo de fallo: ejecutar `decideMatches` directamente sin transacción (p. ej., en
  un endpoint nuevo o en un cron aparte). Arreglo: cambiarlas a arrays JS planos,
  como ya se hizo en `src/ingest/cron.ts` (F-SPEC-008-11). Hay un comentario en
  el código (F-SPEC-008-12). Procedencia: SPEC-008 CA-3 verificación, 2026-09-22.
- **M-5 — El orden de `diff.newTeams` depende del locale** en `src/calendar/sync.ts:196`.
  La línea usa `localeCompare` para ordenar los nombres de equipos nuevos en el
  cuerpo del PR. Solo afecta al texto del PR, nunca a los ficheros JSON de
  `data/calendario/` ni `data/alias/`. Modo de fallo: cosmético (cambio de orden
  en diferentes entornos según el locale del sistema). Arreglo: usar comparación
  de code point en vez de locale. Procedencia: SPEC-008 O-9, 2026-09-22.
- **M-6 — `tickSalud` cuenta `running` como fallo.** En `src/ingest/salud.ts`,
  una ejecución de `cron.job_run_details` con estado `running` se lee como FALLO
  en el cálculo del porcentaje de éxito. Modo de fallo: llamar a `npm run tick:salud`
  justo en el instante en que pg_cron está ejecutando un job dispara un falso
  REVISAR. Arreglo: excluir el estado `running` del conteo de intentos, como
  solo cuenta lo terminal (`succeeded`/`failed`). Procedencia: SPEC-008 O-3, 2026-09-22.
  **→ especificado en SPEC-010 (2026-09-22): ya no está pendiente.**
- **M-8 — `.github/workflows/medir-directo.yml` sigue programado.** Su cabecera
  pide borrarlo cuando la medición esté hecha (lo estuvo el 2026-09-21) y su
  `schedule` no tiene fecha: `cron: '50 14 * * 0'` vuelve a sondear el directo
  del proveedor el domingo 2026-09-27 a las 14:50Z (~67 peticiones) dentro de la
  ventana de medición de SPEC-009. Modo de fallo: gasto de presupuesto del
  proveedor que no aparece en el informe de la jornada. Procedencia: hallazgo del
  arquitecto al escribir SPEC-010, 2026-09-22. **→ especificado en SPEC-010.**

## Riesgos

- El cubo se llena y no se vacía nunca. Mitigación: cada entrada nace con su
  modo de fallo escrito, así que se puede priorizar por daño y no por
  antigüedad; lo que no tenga modo de fallo concreto no entra.
- **M-7 — la ventana de 150 min y el cierre forzoso de 120 están acoplados y
  nada lo ata.** `WINDOW_AFTER_MINUTES = 150` vive en `src/ingest/constants.ts`
  y `FORCED_FINISH_MINUTES = 120` en `src/decide/thresholds.ts`. El barrido solo
  recorre partidos **en ventana**, así que el `forced_finish` de RN-02 únicamente
  puede dispararse porque la ventana llega más allá de los 120. Modo de fallo:
  bajar `WINDOW_AFTER_MINUTES` por debajo de 120 —para ahorrar peticiones, por
  ejemplo— **desactiva RN-02 en silencio** y no rompe ningún test; los partidos
  que la fuente abandona se quedarían en `live` para siempre, sin alerta.
  Arreglo: un test de invariante `FORCED_FINISH_MINUTES < WINDOW_AFTER_MINUTES`,
  como el que ya existe para `SALUD_RECENT_MINUTES < SILENCE_MINUTES`, y una
  línea en el comentario de cada constante. Procedencia: hallazgo del arquitecto
  al escribir `docs/fundacion/como-funciona.md`, 2026-09-22; derivado del código,
  no registrado en ningún ADR.
