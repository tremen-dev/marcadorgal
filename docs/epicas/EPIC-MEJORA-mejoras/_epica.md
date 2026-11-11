---
id: EPIC-MEJORA
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-producto}
---
# EPIC-MEJORA — Mejoras

## Objetivo

Cubo permanente para mejoras pequeñas de producto, UX y calidad que no son un
fallo ni una capacidad nueva con entidad para tener su propia épica: pulidos
que aparecen al verificar, asperezas de la interfaz, limpieza de código o de
tests que no tiene un modo de fallo detrás, e ideas menores del titular. No
tiene fecha de cierre ni compite con las épicas de producto; se vacía en los
huecos entre épicas o cuando una entrada se junta con una spec que ya toca el
mismo sitio.

Existe por la misma razón que EPIC-MANT: decenas de ledgers ya mandan cosas
«a EPIC-MEJORA», y sin un fichero que las reúna mueren en el ledger de una
spec cerrada.

## Criterios de éxito

1. Toda entrada con destino «EPIC-MEJORA» en el ledger de una spec en `hecho`
   está aquí con su procedencia, o se descarta con su razón escrita.
2. Cada entrada dice qué mejora para quien la nota (lector, titular o quien
   mantiene el código). Si no se puede decir, no entra.
3. Nada de aquí es un fallo ni algo que se pudre: si aparece un modo de fallo
   concreto, la entrada pasa a EPIC-MANT; si ya hace daño en producción, a
   EPIC-FIX.

## Alcance

- Dentro: pulidos visuales y de interacción (alturas, objetivos táctiles, CLS
  sin regresión); coherencia de la interfaz y de las maquetas de
  `docs/diseno/`; limpieza sin riesgo (claves i18n muertas, reglas duplicadas,
  avisos de Node, licencias); tests más finos que hoy no dejan pasar nada
  conocido; ideas menores del titular.
- Fuera (aparcado a propósito, no por descuido): fallos activos en producción
  (EPIC-FIX); fallos silenciosos, deuda con modo de fallo escrito y arreglos de
  tooling y workflows (EPIC-MANT); capacidad nueva con entidad propia (su
  épica: clasificaciones, favoritos, patrocinio…); refactores de gusto sin
  beneficio que se pueda nombrar.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

Pendientes de especificar, con su procedencia (sembrado el 2026-11-11;
vigencia comprobada solo donde se dice; «¿MANT?» = candidato a moverse):

- **MJ-1 — «Todos» pierde `?provisional=` en la demo.** El enlace «Todos» del
  filtro navega a la ruta real y no conserva el parámetro. Solo la demo.
  Procedencia: F-SPEC-084-1 («sin destino salvo que el titular lo pida»;
  el titular lo pide aquí, 2026-11-11).
- **MJ-2 — CLS ~0,01 por cambio de fuente** en la primera visita a la xornada
  a 360 px (secciones y nombres de equipo, no la cabecera). Previo a SPEC-084;
  arreglo por métricas de fallback de las fuentes. Procedencia: F-SPEC-084-2.
- **MJ-3 — test de CLS de cabecera con caché fría** y sumando solo
  desplazamientos de nodos dentro de `header` (SPEC-082 CA-6 mide en caliente
  y no vería un futuro salto por fuente). Procedencia: F-SPEC-084-3. ¿MANT?
- **MJ-4 — licencia de fuentes**: `public/fonts/LICENSE.txt` sigue siendo el
  de 2023 (Vercel); poner el `OFL.txt` del release 1.8.0. Vigente. F-SPEC-001-6.
- **MJ-5 — `"type": "module"`** en `package.json` (aviso
  `MODULE_TYPELESS_PACKAGE_JSON`; vigente) y, de paso, imports con `.ts`.
  F-SPEC-003-1, F-SPEC-004-3, F-SPEC-005-10.
- **MJ-6 — claves `waiting.*` de i18n sin uso** y su test. Vigente.
  F-SPEC-020-6.
- **MJ-7 — `currentSeason` duplicada** en `tools/calendario-xornada.mjs` y
  `src/board/current.ts`. Vigente. F-SPEC-020-7.
- **MJ-8 — objetivo táctil < 44 px** en enlaces de día y píldoras (ADR-005).
  F-SPEC-023-3.
- **MJ-9 — contadores del lateral y píldora de cabecera** no siguen al día ni
  al filtro. F-SPEC-023-4.
- **MJ-10 — `Location` repetida** en el primer 307/308 ISR (comprobar en
  Vercel). F-SPEC-027-1.
- **MJ-11 — caché de 404 y redirecciones** de `/xornada/:fecha`
  (`s-maxage=10`): decidir si se quiere distinta. F-SPEC-027-2.
- **MJ-12 — fila plegada con goles 5 px más alta** por la afordancia `▸` en
  una cuarta línea de `.margin`. F-SPEC-068-4.
- **MJ-13 — `Global.tpl.html` aún dibuja `gl·es`** en la cabecera.
  F-SPEC-082-1.
- **MJ-14 — `rfef.json` (22 KB) viaja a todas las rutas de servidor** por
  `outputFileTracingIncludes`. Inocuo. F-SPEC-070-3.
- **MJ-15 — `concurrency` del aviso del calendario** descarta la ejecución
  pendiente más vieja si coinciden tres. F-SPEC-075-1. ¿MANT?
- **MJ-16 — suites que leen `data/calendario/**` vivo**: auditar cuáles
  deberían congelarlo. F-SPEC-078-1. ¿MANT?
- **MJ-17 — `npm run build` no corre en worktree con `node_modules` en
  junction.** Opcional. F-SPEC-080-1. ¿MANT?
- **MJ-18 — timeout de `reconciliacion.db.test.ts`** (3,3 s de 5 s contra BD
  remota). F-SPEC-016-3. ¿MANT?

Aparcados con condición (entran solo si se cumple): F-SPEC-020-9 (`TEMP` de
`web_reader`, si se quiere cerrar), F-SPEC-021-1 (orden de `half_time`, si se
reordena), F-SPEC-022-1 (aserción más fuerte, si se quiere), F-SPEC-035-2 y
F-SPEC-035-5 (comparación de versiones, si importa), F-SPEC-048-2 (filas de
`lastHeard`, si se nota en el tick).

No entran (ya tienen destino o están cerrados): F-SPEC-006-4 (SPEC-008),
R-SPEC-009-9 (SPEC-017), F-SPEC-021-3 (SPEC-022), V-3 de SPEC-040 (SPEC-045),
F-SPEC-040-2 (EPIC-MANT), F-SPEC-065-5 (SPEC-047), F-SPEC-079-6 (cerrado);
F-SPEC-069-3 espera a que SPEC-069 llegue a `hecho`.

## Riesgos

- El cubo se llena de gustos. Mitigación: criterio 2; lo que no nombra a quién
  mejora no entra, y se prioriza por cuánta gente lo nota.
- Frontera borrosa con EPIC-MANT. Mitigación: la regla es el modo de fallo; si
  existe y se puede escribir, es MANT. Las entradas marcadas «¿MANT?» las
  decide el arquitecto al especificarlas.
