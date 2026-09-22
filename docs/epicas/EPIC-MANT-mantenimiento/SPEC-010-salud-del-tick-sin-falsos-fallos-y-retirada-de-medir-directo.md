---
id: SPEC-010
tipo: spec
epica: EPIC-MANT
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-22, por: sdd-arquitecto}
---
# SPEC-010 — Salud del tick sin falsos fallos y retirada de medir-directo

## Problema
Del viernes 2026-09-25 al lunes 2026-09-28 corre la jornada de medición de
SPEC-009 y **`npm run tick:salud` es el único semáforo de vitalidad** que se va
a mirar durante cuatro días (SPEC-009, «Fuera de alcance», último punto). Dos
cosas lo estropean justo esa semana, y las dos están ya analizadas con su modo
de fallo escrito:

1. **M-6 (SPEC-008 O-3, 2026-09-22).** `src/ingest/salud.ts:80` cuenta como
   fallo cualquier `status !== "succeeded"` de `cron.job_run_details`, así que
   una ejecución **en vuelo** (`running`) se lee como `FALLO`, entra en el
   porcentaje de éxito y tira el veredicto a `REVISAR`. Con el job disparando
   cada 30 s, pillarla en vuelo no es teórico: el modo de fallo es llamar a
   `npm run tick:salud` en ese instante y ver un **REVISAR falso**. Un semáforo
   que da rojos falsos la semana en que más se mira es peor que no tenerlo:
   enseña a desconfiar de él, y el rojo verdadero del sábado pasa por otro falso
   más.
2. **`.github/workflows/medir-directo.yml` sigue vivo y vuelve a dispararse
   solo.** Su cabecera dice «Borrar este fichero cuando la medición esté hecha»;
   la medición se hizo el **2026-09-21** y el fichero sigue en `main`. Su
   `schedule` es `cron: '50 14 * * 0'`, **sin fecha**: se dispara otra vez el
   **domingo 2026-09-27 a las 14:50Z** y sondea el directo del proveedor cada
   90 s durante 100 min (**~67 peticiones**). Cae dentro de la franja
   14:00Z-17:00Z que H-3 de SPEC-009 reserva para tomar a mano la referencia
   externa de goles, y solapa con el bloque de más carga (siete partidos de
   Tercera RFEF G1 a la vez a las 16:00Z). La precisión es la diferencia entre un
   fallo real y un susto: **no ensucia el conteo de CA-4 de SPEC-009** —el
   workflow no escribe en `ingest_attempts`— pero **sí gasta presupuesto del
   proveedor sin aparecer en el informe**, así que el contraste de ese bloque con
   los ≤ 6/min y los ~3.000/día del plan Pro (SPEC-005 N-4) diría menos de lo que
   realmente pasó.

## Usuarios / roles afectados
- **Titular:** es quien mira el semáforo esos cuatro días y quien paga las
  peticiones del proveedor.
- **sdd-verificador de SPEC-009:** mide sobre `ingest_attempts` y
  `cron.job_run_details`; el bloque de peticiones de su CA-4 solo es
  contrastable si nadie más pide al proveedor dentro de la ventana.
- **Público y operador: ninguno.** Nada de esto se ve en pantalla.

## Criterios de aceptación
- **CA-1 Una ejecución en vuelo no es un fallo (`src/ingest/salud.ts`).** Dado un
  informe de salud, cuando una fila de `cron.job_run_details` trae un estado **no
  terminal**, entonces no cuenta como fallo, no imprime línea `FALLO` y no entra
  en el denominador del porcentaje de éxito. Los estados no terminales se
  declaran en `SALUD_IN_FLIGHT_STATUSES`, en `src/ingest/constants.ts` junto a
  las otras constantes `SALUD_*` (son semántica del semáforo, no presentación:
  SPEC-008 N-6), y son los cuatro de pg_cron: `starting`, `running`, `sending`,
  `connecting`. **La regla se escribe por lista de en vuelo, no por lista de
  fallo** (`status === "failed"`): un estado que pg_cron añada mañana y que no
  conozcamos tiene que seguir saliendo en rojo, que es la dirección conservadora
  que O-3 daba por buena. `tickSalud` sigue siendo pura: recibe filas, devuelve
  `{ ok, text }`.
- **CA-2 El porcentaje se calcula sobre lo terminal y dice su n.** Dado que el
  numerador ya no cuenta las de en vuelo, cuando se imprime la línea de la
  ventana corta —la que «decide el semáforo»— entonces el porcentaje se calcula
  sobre las ejecuciones **terminales** (`succeeded` + `failed`), la línea dice
  cuántas son y, **cuando hay alguna en vuelo, la nombra con su número**. Sin
  esto el arreglo miente al revés: veinte terminales todas `succeeded` más una
  `running` imprimirían `95 %` con todo sano. Con cero terminales el porcentaje
  es `n/a` (`percent` ya lo hace) y no `0 %`. El bloque de estados de la hora
  (`byStatus`) sigue listando `running: N` tal cual: la fila se ve, solo deja de
  contarse. Lo mismo vale para la línea de la hora y para la coletilla de
  problemas viejos (`stale`).
- **CA-3 Una ejecución en vuelo sigue siendo señal de vida.** Dado un job activo
  en `cron.job`, cuando la ventana corta tiene **solo** filas en vuelo y ninguna
  terminal, entonces el veredicto es `ok: true`: pg_cron disparó, que es justo lo
  que vigila el tercer caso de rojo de SPEC-008 CA-7 (c). El silencio se sigue
  midiendo sobre **todas** las filas recientes, no sobre las terminales. Es la
  trampa de este arreglo: filtrar las no terminales al principio de `tickSalud`
  convertiría un `running` solitario en «cero ejecuciones» y devolvería el mismo
  REVISAR falso por la otra puerta.
- **CA-4 Los tests, y en rojo antes del arreglo (`src/ingest/salud.test.ts`).**
  Sobre las filas fijas que ya usa el fichero, cuatro casos nuevos en el mismo
  `describe`: (i) **veinte `succeeded` y una `running` en la ventana corta →
  `ok: true`, `100 %` y ni una línea `FALLO`** —es el REVISAR falso de M-6 y
  **tiene que caer antes del arreglo**—; (ii) una `running` sola, sin ninguna
  terminal, con el job activo → `ok: true` y porcentaje `n/a` (CA-3); (iii) una
  `failed` y una `running` en la ventana corta → `ok: false` y **una sola** línea
  `FALLO`, la de la `failed` (el arreglo no tapa fallos de verdad); (iv) un
  estado inventado que no está en `SALUD_IN_FLIGHT_STATUSES` → `ok: false` (CA-1,
  la dirección conservadora). El ledger anota la salida de (i) y (iii) **antes**
  del arreglo: es la evidencia de que los casos muerden.
- **CA-5 `medir-directo.yml` fuera, y lo que se queda dicho en claro.** Dado que
  la medición del 2026-09-21 está hecha, cuando se aplique esta spec entonces
  **`.github/workflows/medir-directo.yml` no existe** y `.github/workflows/`
  queda con exactamente dos ficheros, `ci.yml` y `calendario-semanal.yml`. Se
  borra el fichero **entero**, no solo su `schedule` (razón en H-1). Se **queda**
  `tools/medir-directo.mjs`, con su cabecera de uso intacta, porque SPEC-008 H-6
  (ii) y SPEC-009 CA-3 lo citan como el precedente de la medición con referencia
  externa y **sin `schedule` no se dispara solo**; y se queda la línea
  `tools/medicion-*.log` de `.gitignore`, porque el script sigue escribiendo esos
  logs en local (no hay ninguno versionado: `git ls-files 'tools/medicion*'` sale
  vacío, y así sigue). Verificable con `git ls-files .github/workflows` (dos
  líneas) y `grep -rn "cron:" .github/workflows` (solo la del calendario
  semanal). Nada más de `tools/` se toca.
- **CA-6 Gates, y la frontera que esta rama no cruza.** `npm run gates` → salida
  0. `git diff origin/main --stat -- src/decide src/ingest/engine.ts` **vacío**
  (ver la restricción de «Fuera de alcance»: es requisito de una spec ajena, no
  gusto; y se compara contra `origin/main` por lo que dice N-3).
  Bajo `src/`, el diff toca **solo** `src/ingest/salud.ts`,
  `src/ingest/salud.test.ts` y `src/ingest/constants.ts`
  (`git diff main --name-only -- src`). Ninguna migración, ninguna dependencia
  nueva, ningún script nuevo en `package.json` y ningún cambio en
  `tools/tick-salud.mjs`.

## Entidades y reglas afectadas
Tick, Ventana, Frescura, Alert (`docs/fundacion/dominio.md`). D-10 (una página;
el ledger registra evidencia). SPEC-008 **CA-7** entero: esta spec **afina su
letra** sin contradecirla —los tres casos de rojo (a), (b) y (c) siguen en pie;
cambia qué cuenta como (a)— y **N-6** (la ventana corta y el tope de fallos son
semántica del semáforo y viven en `constants.ts`). SPEC-008 ledger **O-3**,
procedencia de M-6, y **O-7**, que ya avisaba de otra arruga de redacción en
CA-7. SPEC-005 **N-4** (el presupuesto del proveedor que las ~67 peticiones del
domingo gastarían a oscuras). SPEC-009 **CA-4**, **CA-7** y **H-3** (la ventana
de medición y la franja de la referencia externa). El invariante
`SALUD_RECENT_MINUTES < SILENCE_MINUTES` que ya afirma `salud.test.ts` no se
toca. Ningún ADR cambia: el semáforo no está en ninguno.

## Fuera de alcance
- **`src/decide/` y `src/ingest/engine.ts`: prohibidos en esta rama.** Razón
  concreta: **CA-10 de SPEC-009 exige que `git diff main --stat -- src/decide
  src/ingest/engine.ts` esté vacío**, y esta rama entra en `main` **antes** de
  que SPEC-009 se verifique; si `main` gana cambios ahí, revienta un criterio de
  una spec ajena que se verifica el 2026-09-28. `src/ingest/salud.ts` y
  `src/ingest/constants.ts` **no** están en esas rutas y sí se tocan (CA-6).
- **M-1, M-2, M-3, M-4, M-5 y M-7 de `_epica.md`.** Siguen pendientes de
  especificar, cada uno con su modo de fallo escrito. Esta spec son dos cambios,
  no un vaciado del cubo.
- **Refactorizar `tickSalud`.** El informe queda como está salvo la línea de la
  ventana corta (CA-2): ni bloques nuevos, ni formato nuevo, ni tocar el tope de
  cinco `FALLO`.
- **`tools/medir-directo.mjs`**, que se queda (CA-5), y volver a medir el directo
  del proveedor: eso es SPEC-009 CA-3.
- **Avisar solo si el tick cae** (un semáforo que te busca en vez de esperar a
  que lo mires). Sigue donde lo dejó SPEC-009: EPIC-MEJORA.

## Notas para el gate humano
- **H-1 (decisión del arquitecto, a confirmar). Se borra el fichero entero, no
  solo el `schedule`.** Quitar el `schedule` y dejar el `workflow_dispatch`
  bastaría para el domingo 27, pero deja en el repo un workflow que nadie
  mantiene, listado en Actions, con `secrets.API_FOOTBALL_KEY` a un clic de
  cualquiera con permiso de escritura, y contradiciendo su propia cabecera
  («borrar cuando la medición esté hecha»), que es exactamente el estado a
  medias que produjo este problema. Lo que se pierde al borrar es **relanzarlo
  desde Actions**, y se recupera entero con `node tools/medir-directo.mjs` en
  local (su uso está en la cabecera del script) o resucitando el YAML desde la
  historia (`deba335`, `86a6fbf`). Verificado que **nada más lo referencia**:
  `src/arch/deploy.test.ts` solo lee `calendario-semanal.yml`, y las únicas
  menciones en `docs/` son a `tools/medir-directo.mjs`, que se queda.
- **H-2 El set de en vuelo es más ancho que el literal de M-6, a propósito.**
  M-6 dice «excluir `running`»; CA-1 excluye los **cuatro** estados no terminales
  de pg_cron (`starting`, `running`, `sending`, `connecting`). Un tick por
  `pg_net` pasa por `sending` y `connecting`, y un `sending` contado como fallo
  es el mismo REVISAR falso con otro nombre. Es el mismo defecto, no un tercer
  cambio; queda dicho por si el gate prefiere el literal.
- **H-3 EPIC-MANT está en `borrador`.** La épica, no la spec. El validador
  (`core/scripts/valida.mjs`) solo exige que la épica **exista**, y ningún rol
  pide que esté `aprobada` para colgarle una spec, así que no bloquea nada
  mecánicamente; pero el roadmap la lista como permanente y comprometida y su
  estado dice otra cosa. **No lo resuelve el arquitecto**: es de producto.
- **H-4 Superficie de conflicto con la rama de SPEC-009:
  `src/ingest/constants.ts`, y es aditiva** (una constante nueva junto a las
  `SALUD_*`). Los otros dos ficheros del diff (`salud.ts`, `salud.test.ts`) no
  están en el alcance de SPEC-009. Si el orden de merge se invierte, el conflicto
  es de una línea.
- **H-5 Esto no afloja el semáforo, y conviene poder demostrarlo el sábado.**
  Después del arreglo siguen siendo rojo: una `failed` reciente, un
  `ingest_attempts.ok = false` reciente, el silencio con job activo, un job
  `INACTIVO` y un estado desconocido (CA-4 (iv)). Lo único que deja de ser rojo
  es una ejecución que está corriendo ahora mismo.
- **N-1 El arreglo es del lado puro.** `tools/tick-salud.mjs` ya pasa `d.status`
  sin interpretarlo, así que la cáscara no cambia (CA-6) y todo el arreglo es
  testable con filas fijas, sin base de datos.
- **N-2 Antes del viernes 25.** El valor de esta spec caduca el 2026-09-25 a las
  18:20Z (inicio de la ventana de SPEC-009): implementada después, el semáforo ya
  habrá dado sus rojos falsos y el workflow del domingo 27 ya estará en marcha.
- **N-3 Cuidado: `main` local puede estar viejo, y entonces el comando de CA-10
  de SPEC-009 miente.** Medido hoy en el worktree de esta rama: `main` apunta a
  `13e05fc`, tres merges por detrás de `origin/main` (`2d6c3f2`), así que
  `git diff main --stat -- src/decide src/ingest/engine.ts` imprime **12 líneas
  en `src/ingest/engine.ts` sin que nadie las haya tocado** —vienen de commits ya
  fusionados—, mientras que contra `origin/main` sale vacío. Por eso CA-6 nombra
  `origin/main`. **Aviso para quien verifique SPEC-009**, cuyo CA-10 usa la forma
  con `main`: conviene un `git fetch` antes, o se lleva un RED falso que no tiene
  nada que ver con esa rama ni con esta.

## Residuales
- **R-SPEC-010-1 — la letra de CA-7 de SPEC-008 queda con dos arrugas
  registradas:** la que arregla esta spec (el estado en vuelo) y la de O-7 (su
  caso de test (3) es contradictorio: 90 min cae fuera de la hora). Ninguna es
  defecto de código. Destino: la primera spec que vuelva a tocar el semáforo, o
  se descarta con razón escrita; no se reescribe la letra de una spec en `hecho`
  solo por eso.
