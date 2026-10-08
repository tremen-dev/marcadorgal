---
id: SPEC-021
tipo: spec
epica: EPIC-003
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-08, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-08, por: sdd-implementador}
---
# SPEC-021 — Descanso dentro de live: del adaptador a la fila

## Problema
SPEC-005 N-7 mapea `HT` a `live` con el minuto de la fuente, y nada más: en `/`
un partido en descanso se ve como «45'» o «45+3'» quieto ~15 min (Girona-Albacete,
`HT` de 19:18:03Z a 19:34:34Z en el crudo de SPEC-012). EPIC-003 pide `live`
(con descanso) y el diseño lo pinta («Descanso. Mesma fila viva, sen minuto que
correr», `Componentes.dc.html`). El descanso es un momento dentro de `live`
(`dominio.md`), nunca un sexto estado: un campo `halfTime` dentro de la rama
`live`, de punta a punta.

## Usuarios / roles afectados
- Público: ve «Descanso» en vez de un minuto parado.
- Titular: aplica la migración **antes** del merge (N-1).

## Criterios de aceptación
- **CA-1 Modelo.** La rama `live` de `MatchState` (`src/model/state.ts`) gana `halfTime: boolean`; ausente se lee como `false` (N-2); las otras cuatro ramas lo rechazan como hoy `addedMinute`. `MatchStatus` sigue con cinco valores. Test: `live` con `halfTime` `true`/`false`/ausente pasa; `finished`, `suspended`, `scheduled` y `postponed` con `halfTime` fallan; `MatchStatus.options` sin cambios.
- **CA-2 Adaptador.** `parse` de `src/sources/api-football/results.ts` da `halfTime: true` en `HT` (y en `BT` según H-1) y `false` explícito en `1H`, `2H`, `ET`, `P`, `LIVE`; `minute` y `addedMinute` siguen N-8 sin cambios. Test sobre crudo real: `live-2026-09-26.json` → Granada-Andorra `live`, `minute` 45, `halfTime: true`, y los cuatro `1H` con `false`; las 247 capturas de `girona-albacete-2026-09-25.json.br` → `halfTime: true` exactamente en las de `HT`.
- **CA-3 Motor (`src/decide/engine.ts`, puro).** `halfTime` entra en la tupla publicada (ausente ≡ `false`): empezar y acabar el descanso publica Decision; observaciones iguales dentro del descanso, no. RN-05, RN-02, RN-03 y el cierre forzoso no cambian: el silencio en descanso publica `sen_sinal` conservando `halfTime`; RN-03 retiene marcador sin tocar `halfTime`; ninguna Decision no `live` lo lleva. Test: replay de Girona con el motor actual → exactamente una Decision publicada pasa a `halfTime: true` (19:18:03Z) y la siguiente que cambia lo devuelve a `false` (19:34:34Z), cero `sen_sinal` en los 16,5 min de descanso y mismo final `finished 2-0`; tabla: silencio de 15 min en descanso → `RN-05` `sen_sinal` con `halfTime: true`; `live` sin `halfTime` y con `false` → misma tupla. `git diff main -- src/decide/fixtures` vacío y los replays existentes en verde.
- **CA-4 Migración aditiva.** `observations` y `decisions` ganan `half_time boolean not null default false` con check `half_time = false or status = 'live'`. `web.xornada` se rehace con `create or replace view` añadiendo `half_time` (`false` sin Decision) como **última** columna; `public.board` no cambia. Test de base: insertar sin `half_time` (lo que hace el código desplegado) → `false`; `half_time = true` en `finished` → `23514`; lista exacta de columnas de la vista con `half_time` al final; el inventario de ADR-015 §3 sigue en verde: `web_reader` solo `SELECT web.xornada` (más el residuo declarado), `42501` en las tablas.
- **CA-5 Escritura y lectura del motor.** `src/ingest/db.ts` y `src/ingest/engine.ts` escriben `half_time` en observaciones y Decisions y lo leen de la Decision vigente y de las observaciones. Test de base: ida y vuelta de una observación y una Decision `live` con `halfTime: true`.
- **CA-6 Contrato público.** `PublicMatch` en `live` exige `halfTime` booleano explícito y lo rechaza en los otros estados (estricto, como `addedMinute`); `src/board/row.ts` lo mapea desde `half_time`. Test: fila `live` con `half_time` → `halfTime`; `live` sin la clave → rechazada y omitida con `console.error` (F-SPEC-019-3); test de base del lector con semilla `live` en descanso; `/api/board` lo devuelve.
- **CA-7 Vista y fila.** `buildXornada` da margen `{ kind: "halfTime" }` a un `live` con `halfTime`, sin minuto aunque lo haya; la fila sigue en el grupo `live`, cuenta en la píldora «en xogo» y conserva tinte e inserto ember (y `sen_sinal` en rojo si lo lleva); punto según H-2. El margen dice `xornada.halfTime` (gl «Descanso», es «Descanso»), nunca `DESC`. `demo.ts` añade un `live` en descanso y uno en descanso `sen_sinal`. Test de tabla en `view.test.ts`; Playwright gl y es a 360 y 390: la fila contiene «Descanso», sin minuto, sin desborde del margen (`scrollWidth ≤ clientWidth`) y sin scroll horizontal.
- **CA-8 Gates.** `npm run gates`, `npm run e2e` y `npm run test:db` en verde. Sin dependencias nuevas. Ni hex sueltos ni `font:`.
- **CA-9 Evidencia real (tras N-1).** En la jornada siguiente al despliegue, en el ledger: una Decision `live` con `half_time = true` de un partido real (consulta SQL), `/api/board` con `halfTime: true` y una captura de `/` con «Descanso».

## Entidades y reglas afectadas
Estado de partido (`dominio.md`: descanso dentro de `live`), Observation,
Decision, Board, Xornada. RN-02, RN-03, RN-05, RN-06, RN-07, RN-09; D-2, D-6,
D-8, D-9. SPEC-005 N-7/N-8 (precisa N-7), ADR-006 (columna nueva, lo amplía),
ADR-014 §3 y ADR-015 §3, ADR-005, SPEC-019 CA-2/CA-3, SPEC-020 CA-2/CA-4.

## Fuera de alcance
Realtime y frescura, escritorio, medición de latencia. Reescribir
observaciones o Decisions antiguas (RN-07: sin backfill; las de antes quedan
`false`). Otras fuentes: la que llegue dará `halfTime` por su contrato.

## Notas para el gate humano
- **H-1 `BT` (pausa antes o dentro de la prórroga).** ¿También «Descanso»? *Recomendación: sí*; es una pausa sin minuto que correr y solo afecta a play-offs.
- **H-2 Punto vivo en descanso.** `Componentes.dc.html` lo quita («sen minuto que correr»); `Movil.tpl.html` lo deja. *Recomendación: sin punto*, como la ficha del componente; el inserto ember dice que sigue en juego.
- **H-3 ¿ADR?** `PublicMatch` (ADR-014 §3) gana un campo. *Recomendación: precisión en esta spec, sin ADR* (precedente SPEC-020 N-2/N-3): no es sensible y no cambia qué se oculta.
- **Decididas por el titular (Alberto Fojo, 2026-10-08):** H-1 = sí (`BT` también «Descanso»); H-2 = sin punto vivo; H-3 = sin ADR, precisión en esta spec. Spec aprobada.
- **N-1 Orden de despliegue: migración primero.** «Merge primero» no es posible: el código nuevo inserta `half_time` y, sin la columna, el tick falla y se para la ingesta. Al revés es seguro: la columna tiene default, la vista solo añade al final y el lector desplegado elige campos de `select *`. 1) GREEN con `test:db` local. 2) `npm run db:push` desde la rama. 3) Comprobar `ingest_attempts` ok y `/api/board` 200 con los mismos partidos. 4) Merge y despliegue. 5) CA-9. El Preview de la PR (lee producción) descarta los `live` hasta el paso 2.
- **N-2** `halfTime` es opcional en el tipo porque los motores congelados de `src/decide/fixtures/` no se editan; en base es `not null default false` y en `PublicMatch` es explícito.
- **N-3** El minuto de la fuente se guarda en descanso (crudo fiel, N-8) y solo la vista lo calla. Se descartó un enum de fases (`first_half`…): más de lo que la pantalla necesita.
