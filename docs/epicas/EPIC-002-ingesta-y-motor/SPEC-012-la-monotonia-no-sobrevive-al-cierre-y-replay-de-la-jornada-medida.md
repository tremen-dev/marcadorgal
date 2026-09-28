---
id: SPEC-012
tipo: spec
epica: EPIC-002
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
---
# SPEC-012 — La monotonía no sobrevive al cierre, y replay de la jornada medida

## Problema
La jornada de SPEC-009 quedó **registrada sin intervención** (criterio 5) pero
**no correcta**: **7 de 39** marcadores finales están mal. Seis vienen de RN-03,
que retiene un gol fantasma de la fuente **hasta el final del partido** porque
la única vuelta que la regla contempla es el operador, y el operador es EPIC-004.
El motor cumple RN-03 al pie de la letra: lo equivocado es la regla (SPEC-009
**N-9**, R-SPEC-009-2). **ADR-010 §1** decide que la monotonía deje de regir en
el instante del cierre. Esta spec aplica esa letra y **repara lo reparable de la
jornada medida**: **cinco** de los siete, por replay determinista sobre el crudo
que aún vive (ADR-007 §5). Los otros dos no tienen observación con el marcador
bueno y son de SPEC-013. **EPIC-002 no cierra hasta que el marcador esté
corregido.**

## Usuarios / roles afectados
- Titular: aprueba antes **ADR-010** —esta spec cambia la letra de una regla de
  `reglas.md`— y decide H-1 y H-3, que no son técnicos.
- sdd-verificador: el corazón de esta spec es un **antes y un después medibles**
  sobre filas que ya existen. No hay trabajo de campo ni fecha de espera.
- sdd-producto: es lo que permite cerrar EPIC-002. La letra de la épica la toca
  producto, no el arquitecto (N-7 de SPEC-009).
- Operador y público: ninguno. Nada se publica en pantalla (EPIC-003) y ninguna
  alerta se resuelve (EPIC-004).

## Criterios de aceptación
- **CA-1 `reglas.md` dice lo que ADR-010 §1 fija, palabra por palabra.** RN-03 pasa a la letra nueva del ADR: la monotonía rige **mientras el partido está en juego** y **no sobrevive al cierre**. RN-06 **no se reordena** —RN-03 no tiene nada que decir en el cierre— y la regla no se marca derogada: se enmienda, con fecha y con ADR-010 citado al lado. Verificable: el texto de RN-03 en `reglas.md` es idéntico al bloque citado de ADR-010 §1, sin una palabra de más.
- **CA-2 El cierre publica el marcador de la observación ganadora.** En `src/decide/engine.ts`, la transición a `finished` —la confirme la fuente o la fuerce RN-02 a kickoff + 120— publica el marcador de la observación ganadora por RN-01, no el retenido; si no hay observación fresca dentro de `OBSERVATION_WINDOW_MINUTES`, publica el vigente. Tests en `src/decide/engine.test.ts`, cinco casos: (i) marcador retenido 2-1 y `finished` de la fuente con 2-0 → se publica **2-0**; (ii) cierre forzoso a +120 con observación fresca `live 1-0` y vigente `1-1` → se publica **1-0**; (iii) cierre forzoso **sin** observación fresca → se publica el vigente y nada cambia; (iv) **en vivo** una bajada sigue reteniendo y abriendo `regression`, sin un solo cambio de comportamiento; (v) la alerta `regression` abierta **sigue abierta** después del cierre: el cierre no la resuelve (EPIC-004).
- **CA-3 El replay reproduce la jornada medida, y el fixture lo demuestra.** Fixture en el repo con las observaciones reales de **`girona-albacete`** (ventana completa, descargadas del almacén y anonimizadas de cabeceras y clave), más una fila en su `README.md` con el comando y la fecha. Test en `src/decide/replay.test.ts`: con el motor **de hoy** el replay termina en `finished 2-1`, y con el motor de CA-2 termina en `finished 2-0`, que es lo que dio el proveedor y la crónica. El test corre **contra el fixture del repo, nunca contra la red ni contra la base**.
- **CA-4 Los cinco marcadores corregidos, y la corrección es una adición.** `npm run replay:jornada -- <desde> <hasta> [--aplicar]` lee las `observations` de la ventana, replaya partido a partido con el motor de CA-2 y **sin `--aplicar` no escribe nada**: imprime una tabla con `matchId`, marcador de `board`, marcador del replay y si divergen. Con `--aplicar` añade **una** Decision nueva por partido divergente —nunca un log entero— con el marcador del replay, `rule` `RN-02`, los `observation_ids` que la sostienen (RN-06) y `decided_at` **de hoy**: corregir es añadir (RN-07), nada se actualiza ni se borra. Evidencia obligatoria en el ledger: conteo de `decisions` antes y después, y `board` de los siete partidos antes y después. Resultado esperado y comprobable: **5 corregidos** (`girona-albacete` 2-1 → 2-0, `lugo-racing-ferrol` 1-1 → 1-0, `celta-fortuna-sabadell` 1-2 → 1-1, `mirandes-unionistas` 0-1 → 1-0, `burgos-eldense` 0-1 → 1-0) y **2 sin tocar**.
- **CA-5 Los dos que no se arreglan se nombran, con su número.** El ledger deja escrito que `ceuta-real-sociedad-b` (board 2-1, proveedor 3-1) y `merida-logrones` (board 3-4, proveedor 3-5) **siguen mal al cerrar esta spec** y por qué: su última observación guardada **coincide** con el marcador publicado, así que no hay nada retenido que soltar y el replay no puede inventar el dato que no se capturó (SPEC-009 N-9). Destino: **SPEC-013**. Tras CA-4, el contraste de la jornada pasa de **32 de 39** a **37 de 39** coincidentes, y ese par de números va en el ledger.
- **CA-6 Nada se regenera y nada se rompe.** El informe `_qa/SPEC-009/informe-jornada-2026-09-28.md` **no se toca** (F-SPEC-009-2: lleva explicaciones escritas a mano y no se puede regenerar); la corrección se anota en una nota fechada aparte, en el `_qa/` de esta spec. `npm run gates` → salida 0 y `npm run test:db` en verde. `git diff main --stat -- supabase` **vacío**: ninguna migración, `decisions.rule` no gana valores nuevos. `package.json` sin dependencias nuevas y solo el script `replay:jornada`.

## Entidades y reglas afectadas
Observation, Decision, Alert, Board (dominio.md). **RN-03** (la enmienda),
RN-01 (la observación ganadora es la que manda al cerrar), RN-02 (el cierre, con
y sin confirmación de la fuente), RN-06 (la Decision añadida registra su regla y
sus observaciones), RN-07 (append-only: corregir es añadir). **ADR-010 §1 y §4**
es lo que esta spec ejecuta; ADR-004 (motor puro y replayable) y ADR-009 (doble
enganche y orden de evaluación) siguen vigentes y sin contradicción; ADR-007 §5
(el crudo de 30 días es el margen que tiene el replay, y **vence el 2026-10-25**
para las observaciones más viejas de la ventana). SPEC-007 CA-8 (replay),
SPEC-009 N-9, CA-9 (c2-ii) y R-SPEC-009-2 (el encargo).

## Fuera de alcance
- **Los dos partidos de cierre forzoso**, RN-12, la extensión de ventana y su migración: **SPEC-013** (ADR-010 §2 y §3).
- **Resolver las alertas** `regression` que la jornada dejó abiertas: EPIC-004. Esta spec deja de propagar su error; no las cierra.
- **Segunda fuente (RN-04) y operador**: EPIC-004, y son el arreglo de fondo (ADR-010, alternativas).
- **Regenerar el informe de SPEC-009** o volver a medir nada: la jornada no se repite (CA-9 (c2)).
- Los demás residuales de la jornada: R-SPEC-009-3 y -6 son de producto; -4, -5 y -7 son del arquitecto y van por su cuenta.
- Pantalla, snapshot y Realtime: EPIC-003.

## Notas para el gate humano
- **H-1 (abierto). ¿Se aplica la corrección a `dev`, o solo se demuestra?** CA-4 con `--aplicar` escribe cinco Decisions nuevas sobre las filas de la jornada medida. A favor: es lo que hace que EPIC-002 pueda cerrar con el marcador **correcto**, que es la condición que el titular puso el 2026-09-29. En contra: `dev` es donde vive la evidencia de SPEC-009. **Mi recomendación: aplicar**, porque la alternativa deja la épica cerrando con un marcador que todos sabemos mal, y porque RN-07 hace la operación reversible por lectura: la versión vieja sigue ahí.
- **H-2 (abierto, y es el que de verdad importa). La corrección no invalida el criterio 5, pero hay que decidirlo en voz alta.** H-2 (i) de SPEC-009 dice que tocar `decisions` **invalida** el criterio 5. Lo que CA-4 hace **no es eso**: ocurre **fuera** de la ventana ya cerrada, lo escribe una **regla del sistema** con su `rule` y sus `observation_ids`, no una persona con un `update`, y el informe del 2026-09-28 se queda intacto como evidencia de **lo que el sistema hizo**. La corrección es un hecho **posterior y fechado**, no un retoque del pasado. Pero la frontera es fina y la escribo aquí para que se cruce a propósito y no de puntillas.
- **H-3 (abierto). El reloj del crudo corre.** ADR-007 §5 retiene 30 días: las observaciones del 25 de septiembre **se purgan el 25 de octubre**. El replay de CA-3 y CA-4 se sostiene sobre `observations`, que son append-only y no se purgan, así que el arreglo no caduca; lo que caduca es poder **volver al crudo** a comprobarlo. Si esta spec no se implementa antes del **2026-10-25**, el fixture de CA-3 hay que capturarlo igualmente ahora.
- **N-1 Esta spec no puede aprobarse antes que ADR-010.** CA-1 cambia la letra de una regla de `reglas.md`, y eso no se hace con una spec aprobada sobre un ADR en borrador.
- **N-2 Las dos retenciones que acertaron no se rompen.** `eibar-las-palmas` (87 confirmaciones) y `barakaldo-aviles` (46) acabaron **bien** con RN-03 reteniendo, y con la enmienda siguen bien: en los dos el marcador del proveedor al cierre ya coincidía con el publicado, y por eso **no están entre las siete discrepancias**. Comprobado por el verificador contra `board` (V-14). CA-4 lo vuelve a comprobar sin querer: el replay no debe divergir en esos dos.
- **N-3 Por qué no un umbral de confirmaciones.** Era la hipótesis obvia y **el dato la refuta**: los dos aciertos tienen 46 y 87 confirmaciones seguidas del marcador bajo y el peor fallo tiene **3**. Cualquier listón parte el grupo por la mitad. Está en ADR-010 como alternativa rechazada y no hace falta volver a discutirlo en el gate.
