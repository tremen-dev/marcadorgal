---
id: SPEC-017
tipo: spec
epica: EPIC-MANT
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-29, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-06, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-06, por: sdd-implementador}
---
# SPEC-017 — Mejoras del informe de jornada

## Problema
El generador de SPEC-009 (`src/ingest/informe.ts`, `informe-db.ts`,
`contraste.ts`, `tools/informe-jornada.mjs`) vuelve a correr en la jornada del
**2026-10-09/12**, la primera con Primera División (R-SPEC-009-1), y antes en la
del 2026-10-02/04. Cuatro defectos medidos, cada uno con su modo de fallo,
reunidos por decisión de Alberto Fojo (2026-09-29):

1. **R-SPEC-009-10 (V-16).** El contraste de CA-5 no se guarda: cada
   regeneración con veredicto vuelve a pedir al proveedor (3 tandas, 6
   peticiones en la jornada medida). Choca con «una sola vez» y con **RN-09**: el
   contraste parsea una respuesta que nunca guardó.
2. **R-SPEC-009-4.** «Partidos sin señal» (CA-4 (b)) no ve un partido que la
   fuente nunca mostró en juego: 5 de 39 pasaron de `scheduled` a `finished`
   con cientos de observaciones, cero `live` y ningún hueco
   (`_qa/SPEC-009/hallazgos-jornada.md`, hallazgo 1). Ningún bloque los nombra.
3. **F-SPEC-013-4.** `ventanaEfectiva` cierra en el `decided_at` del `finished`
   vigente. Con SPEC-013 CA-3 un `finished` RN-02 deja el partido en ventana
   hasta +150; esos ticks saldrán como «tras el cierre», no como cobertura, y la
   cobertura de CA-9 bajará sin que falle nada.
4. **R-SPEC-009-9 (V-13).** CA-7 y N-2 de SPEC-009 nombran `cron.job_run_details`
   y el generador no la lee: la vitalidad de pg_cron la midió el verificador a
   mano.

## Usuarios / roles afectados
- **Titular:** genera y lee el informe; paga las peticiones del proveedor.
- **sdd-verificador de SPEC-013** (CA-5/CA-7, lunes 2026-10-05) y de la jornada
  del 2026-10-09/12: leen cobertura y contraste. **Público y operador: ninguno.**

## Criterios de aceptación
- **CA-1 Crudo del contraste antes que parseo.** Dado `--contrastar` sin
  contraste guardado para la ventana, cuando se pide al proveedor, entonces cada
  captura `ids=` (una por temporada) se guarda con `storeCapture` (ADR-007 §2)
  **antes** de `adapter.parse`, con la etiqueta `contraste-<desde>-<hasta>-<temporada>`
  en el hueco del id de intento (sin `:`, como la etiqueta de SPEC-013 CA-6); si
  `put` falla no se parsea nada y el comando sale ≠ 0 (ADR-007 §6). El bloque 8
  imprime el `raw_ref` en la **misma línea** que «peticiones del contraste».
  Tests en `src/ingest/contraste.test.ts` con `createMemoryRawStore` y `fetch`
  doble: «SPEC-017 CA-1 guarda el crudo antes de parsear» (orden put → parse) y
  «SPEC-017 CA-1 sin crudo guardado no hay contraste» (put que lanza → parse no
  se llama).
- **CA-2 Regenerar relee; pedir de nuevo es explícito.** Dado un contraste
  guardado para la misma ventana (`informe-db.ts` lo busca en `storage.objects`
  por su etiqueta, solo lectura, como la purga de ADR-007 §5), cuando se corre
  `--contrastar`, entonces se relee y re-parsea con el adaptador actual, **cero**
  peticiones, y la línea dice `0 en esta ejecución; releído de <raw_ref>,
  capturado <capturedAt>, <n> peticiones entonces`. Solo `--recontrastar` pide
  otra vez (objeto nuevo; se usa el más reciente). Si el objeto no se puede leer
  (`get` → `null`) no se pide: contraste ausente con su motivo, y el veredicto es
  `sin veredicto` (V-15). Tests: `contraste.test.ts` «SPEC-017 CA-2 releer no
  pide» (0 llamadas a `fetch`, mismas filas), «…`--recontrastar` pide y guarda
  otro», «…captura ilegible: sin contraste y sin petición»; `informe.test.ts`
  «SPEC-017 CA-2 la línea dice de dónde sale el contraste»; `informe.db.test.ts`
  «SPEC-017 CA-2 encuentra el contraste por su etiqueta» (objetos sembrados en
  `storage.objects` en transacción con rollback, como `db.db.test.ts`).
- **CA-3 Partidos sin directo (bloque 6).** Dado un partido con Decision vigente
  `finished`, al menos una observación en la ventana y **ninguna** `live`,
  entonces el bloque 6 lo cuenta en **una** línea `sin ninguna observación en
  juego: N` con la muestra de `enLinea`, e `Informe.sinSenal.sinDirecto` lo
  lleva. No entra en el veredicto. Tests en `informe.test.ts`, «SPEC-017 CA-3»:
  (i) 270 `scheduled` y cierre `finished` → listado; (ii) con una `live` → no;
  (iii) cero observaciones → solo en «sin ninguna observación»; (iv) `postponed`
  → no; (v) el veredicto es idéntico con y sin él. Campo: regenerar a stdout la
  ventana `2026-09-25T18:20Z 2026-09-28T21:00Z` **sin** `--contrastar` imprime 5
  y los cinco del hallazgo 1.
- **CA-4 La prórroga del cierre forzoso es cobertura.** Dado un partido cuya
  Decision vigente es `finished` con regla `RN-02`, entonces su ventana efectiva
  llega a kickoff + `WINDOW_AFTER_MINUTES`, la misma regla que `isInWindow`
  (`src/ingest/window.ts`, SPEC-013 CA-3); cualquier otra vigente `finished`
  (RN-01, RN-12) cierra en su `decided_at`, como hoy. La regla vigente la trae
  `informe-db.ts` de la Decision de `board` (`decision_id`). Cuando entre
  SPEC-014 CA-8, el criterio pasa a ser `forcedFinish === true` y no la regla,
  porque las 5 correcciones de SPEC-012 también son RN-02 (N-2). Las dos líneas
  explicativas del bloque 1 lo dicen sin crecer. Tests en `informe.test.ts`, «SPEC-017 CA-4»: (i) RN-02 a +120
  con ticks cada 30 s hasta +150 → cobertura 100 % y `tras el cierre` 0;
  (ii) RN-02 y luego RN-12 a +135 → la ventana cierra a +135 y los ticks
  posteriores son «tras el cierre»; (iii) RN-01 a +105 → sin cambio.
- **CA-5 pg_cron en el informe.** Dada la ventana, `informe-db.ts` lee
  `cron.job_run_details` (con `cron.job` para el nombre, como
  `tools/tick-salud.mjs`) y el bloque 1 imprime **una** línea: ejecuciones por
  estado y horas de ventana sin ninguna ejecución, con muestra `enLinea`. Si la
  consulta falla o no hay filas, la línea dice `sin datos` y su motivo; el
  informe no lanza. No entra en el veredicto: la cobertura sigue saliendo de
  `ingest_attempts` (CA-9 de SPEC-009). Tests: `informe.test.ts` «SPEC-017
  CA-5» (todas las horas cubiertas → 0; una hora sin ejecución → listada; sin
  datos → la línea lo dice); `informe.db.test.ts` «SPEC-017 CA-5 lee
  cron.job_run_details» (fila sembrada con rollback).
- **CA-6 Tope, informe entregado y fronteras.** El test del techo de CA-10 de
  SPEC-009 («con todos los ejes acotados saturados a la vez») incluye las líneas
  nuevas y sigue ≤ `INFORME_MAX_LINEAS`; `INFORME_MAX_LINEAS` e
  `INFORME_FILAS_MOSTRADAS` sin cambiar. `git diff origin/main --
  docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/` vacío (F-SPEC-009-2). Bajo
  `src/` solo `src/ingest/{informe,informe-db,contraste}.ts`, sus tests y, si
  hace falta, constantes **nuevas** en `constants.ts`; `src/decide`,
  `engine.ts` y `window.ts` intactos. Sin migraciones, sin dependencias ni
  scripts nuevos en `package.json`. `npm run gates` → 0 y `npm run test:db` en
  verde. Ninguna verificación pide al proveedor: CA-1/CA-2 se prueban con dobles.

## Entidades y reglas afectadas
Observation, Decision, Tick, Ventana, Raw capture (`dominio.md`). RN-02, RN-09,
RN-12 (`reglas.md`). ADR-007 §2, §5, §6; ADR-010 §3. SPEC-009 CA-4 (b), CA-5,
CA-7, CA-9 (V-15, N-8, N-9, N-10) y CA-10; SPEC-013 CA-3.

## Fuera de alcance
- Regenerar `informe-jornada-2026-09-28.md` (F-SPEC-009-2) o contrastar otra vez
  la jornada medida: sería la 4.ª tanda.
- Cambiar umbrales o ramas de CA-9 de SPEC-009; que los partidos sin directo
  bajen el veredicto (R-SPEC-009-3 es de EPIC-004).
- Enmendar RN-08; automatizar el contraste en el tick (ADR-010 §4).
- Latencia interna con segundo reloj (R-SPEC-009-7, EPIC-003); desfase de
  calendario (R-SPEC-009-5); explicaciones a mano por partido (F-SPEC-009-4).
- La guarda contra sobrescribir el fichero de `--salida` (modo de fallo de
  F-SPEC-009-2): entrada nueva de EPIC-MANT (H-5).

## Notas para el gate humano
Decididas por Alberto Fojo el 2026-09-29, todas según la recomendación:
- **H-1** `--contrastar` relee el guardado y pide solo si no hay; `--recontrastar`
  fuerza (CA-2). Pasada la purga de 30 días (ADR-007 §5) pediría otra tanda,
  visible por su `capturado`.
- **H-2** La línea «sin ninguna observación en juego» no baja el veredicto (CA-3).
- **H-3** CA-4 no hace excepción con ventanas anteriores al despliegue de SPEC-013.
- **H-4** pg_cron (`cron.job_run_details`) es solo informativo; la cobertura
  sigue saliendo de `ingest_attempts` (CA-5).
- **H-5** La guarda de `--salida` queda fuera (ver «Fuera de alcance»).
- **N-2 Criterio de CA-4 y SPEC-014 CA-8** (añadido del orquestador, aprobado).
  Hoy se reconoce el cierre forzoso por `rule = RN-02`; cuando entre la columna
  `decisions.forced_finish`, por la marca. SPEC-017 no espera a SPEC-014: la que
  se mergee después adapta `informe-db.ts` y añade a CA-4 el caso (iv): una
  corrección RN-02 con marca `false` cierra en su `decided_at`.
- **N-1 Depende de SPEC-013** (`window.ts`, RN-12 en `DecisionRule`), que sigue
  `en-revision` hasta el 2026-10-05: la rama sale de la suya o de `main` tras
  su merge. Plazo duro: antes del 2026-10-09; si entra antes del 2026-10-02, el
  contraste de esa jornada es la primera prueba de campo de CA-2.
