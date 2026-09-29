---
id: SPEC-013
tipo: spec
epica: EPIC-002
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-29, por: Alberto Fojo}
---
# SPEC-013 — Reconciliación del marcador después del cierre forzoso

## Problema
La fuente **no confirma el final**: **9 de los 39** partidos de la jornada medida
se cerraron con RN-02 a kickoff + 120, todos con `minute: 90` y
`lastStatus: live`. La fuente los deja clavados en el 90 y manda el resultado
definitivo **más tarde**. El precio son **2 marcadores cerrados en falso** —
`ceuta-real-sociedad-b` (2-1 contra el 3-1 del proveedor) y `merida-logrones`
(3-4 contra 3-5)— que **SPEC-012 no puede arreglar por replay**: su última
observación guardada **coincide** con lo publicado, porque dejamos de mirar. Y
dejamos de mirar por un atajo del código: `isInWindow` saca al partido de la
ventana en cuanto hay una Decision `finished`, **treinta minutos antes** del
borde de ADR-002 §2 (`WINDOW_AFTER_MINUTES = 150`). **ADR-010 §2 y §3** deciden
la vuelta: el cierre forzoso no saca de la ventana, y el marcador final que la
fuente confirme después se acepta con regla **RN-12**. Esta spec es lo último que
le falta a EPIC-002 para cerrar con el marcador **correcto**, no solo registrado
(SPEC-009 N-9).

## Usuarios / roles afectados
- Titular: aprueba antes **ADR-010**, y decidió **H-1** (se corrigen los dos
  partidos de la jornada ya medida) y **H-2** (CA-5 espera a la jornada del
  2026-10-02/04).
- sdd-verificador: CA-1 a CA-4 y CA-7 se verifican sin campo; **CA-5 es de campo
  y con fecha** (jornada del 2026-10-02/04), y CA-6 es una ejecución única con
  antes y después.
- sdd-producto: con esto EPIC-002 puede cerrar con 39 de 39. La letra de la
  épica la escribe producto (N-7 de SPEC-009).
- Operador y público: ninguno. Las alertas `forced_finish` **no se resuelven**
  (EPIC-004); que se abran siempre es lo único que hizo visible este patrón.

## Criterios de aceptación
- **CA-1 `reglas.md` gana RN-12, palabra por palabra de ADR-010 §2.** Un partido cerrado por el cierre forzoso de RN-02 acepta el marcador final que la fuente confirme después, mientras su ventana siga abierta: cambia el marcador y el cualificador, **nunca el estado**, y se registra con regla `RN-12`. RN-12 entra en la lista de «las únicas que pueden aparecer en `Decision.rule`». **RN-08 no se toca**, y el diff lo demuestra: la ventana declarada sigue siendo la misma y el criterio 2 de EPIC-002 se mide con la misma consulta.
- **CA-2 `RN-12` existe de punta a punta.** Migración SQL con la CLI de Supabase que amplía `check (rule in (…))` de `decisions` con `'RN-12'` (hoy: `supabase/migrations/20260920220153_append_only_logs.sql:52`) y `DecisionRule` de `src/model/vocab.ts` con el mismo valor. Es la primera migración de EPIC-002 desde el esquema base. Tests: en `informe.db.test.ts` o `engine.db.test.ts`, sembrado en transacción con rollback, una Decision con `rule: 'RN-12'` **inserta**, y una con un valor inventado **sigue siendo rechazada** por el check — las dos direcciones, no solo la buena.
- **CA-3 El cierre forzoso no saca al partido de la ventana.** `isInWindow` (`src/ingest/window.ts`) deja de devolver `false` por el mero hecho de haber un `finished`: un `finished` **provisional por cierre forzoso** mantiene el partido en ventana hasta el borde de tiempo (+150) o hasta que la fuente confirme el final, lo que antes ocurra; un `finished` **confirmado** sigue cerrando la ventana en el acto, como hoy. La función sigue siendo pura y `now` sigue entrando por la ruta. Tests en `src/ingest/window.test.ts`, cuatro casos: (i) `finished` confirmado a +125 → **fuera**; (ii) `finished` provisional por cierre forzoso a +125 → **dentro**; (iii) el mismo a +151 → **fuera** (el borde de tiempo manda igual); (iv) `live` a +125 → dentro, sin cambio.
- **CA-4 RN-12 acepta el final que la fuente confirma, y solo eso.** En `src/decide/engine.ts`: con una Decision vigente `finished` `provisional` por cierre forzoso, una observación `finished` de la fuente ganadora publica una Decision nueva con **su** marcador, `rule: 'RN-12'`, cualificador `confirmado` y estado `finished` sin cambiar. Tests en `engine.test.ts`, cinco casos: (i) vigente `finished 2-1` provisional + observación `finished 3-1` → se publica `finished 3-1` con `RN-12`; (ii) el marcador **baja** (3-4 → 3-3): también se publica, porque RN-03 ya no rige tras el cierre (ADR-010 §1); (iii) una observación `live` tras el cierre **no** devuelve el partido a `live` ni publica nada; (iv) un `finished` **confirmado** vigente no admite RN-12: nada se publica; (v) la alerta `forced_finish` abierta **sigue abierta**.
- **CA-5 Medido en campo: cuántos cierres forzosos se confirman en la prórroga.** Que la fuente mande el final entre +120 y +150 es una **hipótesis**, y no se puede validar con el dato guardado precisamente porque dejamos de mirar ahí. Se mide en la jornada del **2026-10-02/04** con una lectura, no con una campaña: de las alertas `forced_finish` de esa ventana, cuántas acaban con una Decision `RN-12` dentro de los 30 min, con el retraso mediano y el máximo. Los tres números van al ledger. Si salen **cero**, la conclusión que se escribe es que 30 min no bastan y que la salida es subir `WINDOW_AFTER_MINUTES`, no que RN-12 no sirva.
- **CA-6 Los dos partidos de la jornada medida, corregidos, y la excepción escrita.** Ejecución **única** y autorizada (H-1): se pide al proveedor `ceuta-real-sociedad-b` y `merida-logrones` por `ids=` con el camino de `src/ingest/contraste.ts`, se **guarda el crudo antes de parsear** (RN-09), se inserta la Observation resultante y el motor publica la Decision `RN-12`. Nada se hace a mano: lo único que la spec autoriza a mano es **correr el script una vez**, porque la ventana de esos partidos venció hace días y RN-12 pide ventana abierta. La excepción se escribe en el ledger con su fecha, su autorización y el `raw_ref` de las dos capturas; no se convierte en regla. Después: `board` dice **3-1** y **3-5**, el contraste de la jornada da **39 de 39**, y el conteo de `decisions` sube exactamente en dos.
- **CA-7 Gates, presupuesto y nada de más.** `npm run gates` → salida 0 y `npm run test:db` en verde. **Una** migración y ninguna otra; `package.json` sin dependencias nuevas. Las peticiones de la jornada del 2026-10-02/04 se contrastan con el presupuesto de SPEC-005 N-4 (≤ 6/min, ~3.000/día): la prórroga de ventana **no debe mover el total de forma apreciable**, porque el partido clavado en el 90 ya venía en la llamada `live=`. Si lo mueve, el número va al ledger y se dice.

## Entidades y reglas afectadas
Observation, Decision, Alert, Ventana, Cualificador, Board (dominio.md).
**RN-12** (nueva), **RN-02** (el cierre forzoso deja de ser el final de la
historia), RN-01 (la fuente ganadora sigue siendo quien habla), RN-03 con la
enmienda de SPEC-012 (por eso (ii) de CA-4 puede bajar el marcador), RN-06
(`rule` y `observation_ids`), RN-07 (append-only), RN-08 (**sin cambios**, y se
comprueba), RN-09 (el crudo de CA-6 se guarda antes de parsearse).
**ADR-010 §2 y §3** es lo que esta spec ejecuta; ADR-002 §2 (la ventana, que no
se toca), ADR-004 y ADR-009 (motor puro, doble enganche y barrido: RN-12 dispara
por observación, no por ausencia), ADR-006 §3 (append-only y versión de
Decision), ADR-008 §2. SPEC-005 N-4 (presupuesto), SPEC-007 (motor y alertas),
SPEC-009 CA-5 (el camino `ids=` que CA-6 reutiliza), N-9 y R-SPEC-009-2.
**Depende de SPEC-012**: CA-4 (ii) solo es legal con RN-03 ya enmendada.

## Fuera de alcance
- **Las seis regresiones de RN-03 y el replay de la jornada**: SPEC-012.
- **Resolver** las alertas `forced_finish` o `regression`: EPIC-004.
- **Segunda fuente (RN-04)** y operador: EPIC-004, y siguen siendo el arreglo de fondo.
- **Automatizar la ronda `ids=` dentro del tick**: ADR-010 §4 la deja a mano, como auditoría de jornada (`--contrastar`, SPEC-009 CA-5).
- **Subir `WINDOW_AFTER_MINUTES`**: solo si CA-5 lo pide, y entonces con su número.
- **Regenerar el informe de SPEC-009** (F-SPEC-009-2) o volver a medir la jornada.
- Los residuales de producto y los otros del arquitecto (R-SPEC-009-3 a -7).

## Notas para el gate humano
- **H-1 (DECIDIDO por Alberto Fojo, 2026-09-29: se corrigen). ¿Se corrigen los dos partidos de la jornada ya medida?** **Autorizada la ejecución única de CA-6** sobre `ceuta-real-sociedad-b` y `merida-logrones`, con las condiciones que la propia CA-6 impone y que no son negociables: se pide por `ids=` con el camino de `src/ingest/contraste.ts`, **se guarda el crudo antes de parsear** (RN-09), lo publica el motor y no la mano, y la excepción se escribe en el ledger **con fecha, autorización y el `raw_ref` de las dos capturas**. Es el **último acto de la jornada medida**, no una vía abierta: no se convierte en regla, no se repite, y cualquier otro partido fuera de ventana necesita su propia autorización escrita. Razón de la decisión: es lo único que lleva el contraste a **39 de 39**, y cerrar EPIC-002 diciendo 39 sin hacerlo no sería honesto. El razonamiento de abajo se conserva porque sigue siendo el porqué de la letra. CA-6 lo hace con una ejecución única que **sí** toca las filas de la jornada, fuera de su ventana y fuera de la letra de RN-12. A favor: es lo único que lleva el contraste a 39 de 39, que es la condición que el titular puso el 2026-09-29. En contra: es una excepción, y las excepciones que no se escriben se repiten — por eso CA-6 obliga a escribirla con fecha, autorización y `raw_ref`. **Mi recomendación: hacerlo**, y que quede como el último acto de la jornada, no como una vía abierta. La alternativa honesta, si se rechaza, es cerrar EPIC-002 con **37 de 39** y un residual nombrado que espera al operador de EPIC-004; lo que no es honesto es cerrar diciendo 39.
- **H-2 (DECIDIDO por Alberto Fojo, 2026-09-29: se espera a medir). CA-5 pone esta spec en el reloj de la jornada del 2026-10-02/04.** **CA-5 se queda como está, de campo**, en la jornada del 2026-10-02/04. La spec se implementa ya (CA-1 a CA-4, CA-6 y CA-7) y queda en **`en-revision` hasta leer CA-5**: no llega a `hecho` antes del lunes 2026-10-05. Razón: la hipótesis sin medir se paga después (lección de SPEC-009). El razonamiento de abajo se conserva porque es el porqué de la letra. Tal como está escrita, SPEC-013 no puede llegar a `hecho` antes del lunes 5. Si eso es demasiado para EPIC-002, la alternativa es sacar CA-5 a residual (medir la prórroga en la primera jornada que corra) y cerrar la spec con CA-1 a CA-4, CA-6 y CA-7. **No lo decido yo**: es la misma disyuntiva que SPEC-009 resolvió midiendo, y la lección de esa spec fue que la hipótesis sin medir se paga después. Lo digo para que se elija a la vista, no por descuido.
- **N-1 Esta spec va detrás de SPEC-012.** CA-4 (ii) —aceptar un marcador que **baja** tras el cierre— solo es legal con la enmienda de RN-03 ya en `reglas.md`.
- **N-2 La prórroga es casi gratis, y el porqué importa.** El partido clavado en el 90 **sigue saliendo en la llamada `live=`** que el tick ya hace, así que la prórroga no añade peticiones: añade hasta 30 min de tick despierto por los partidos que la fuente no cierra. CA-7 lo comprueba en vez de suponerlo.
- **N-3 Esto no existe sin una decisión del gate de SPEC-007.** Que el cierre forzoso **abra siempre alerta** es lo único que hizo visible el patrón: 9 partidos de 39 se habrían cerrado sin que nadie lo supiera. Queda anotado porque es el ejemplo de para qué sirve una alerta que nadie resuelve todavía.
