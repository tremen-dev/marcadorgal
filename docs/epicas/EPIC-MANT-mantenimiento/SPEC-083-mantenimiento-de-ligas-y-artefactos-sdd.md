---
id: SPEC-083
tipo: spec
epica: EPIC-MANT
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-11, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-11, por: sdd-verificador}
---
# SPEC-083 — Mantenimiento de ligas y artefactos sdd

## Problema
Restos de SPEC-057/082 y deuda sdd: el panel «⚙ Ligas» nombra equipos
(`· Depor ABANCA`, `· As Celtas`) junto a las ligas; `src/model/competitions.ts`
lleva colores `rgb()` a mano (F-SPEC-057-6) que no coinciden con
`LEAGUE_COLORS` en las cinco ligas masculinas; el preset `Feminino` en una
xornada sin ligas femeninas deja la pantalla vacía y muda (nota de la 3ª
ronda de SPEC-057); `Global.tpl.html` aún dibuja `gl·es` en la cabecera; y
`valida.mjs` da 9 errores.

## Usuarios / roles afectados
Afición (panel y portada, gl y es); titular y roles sdd (`valida.mjs` limpio).

## Criterios de aceptación
- **CA-1 El filtro solo nombra ligas.** Dado el panel «⚙ Ligas» abierto en `/`
  y `/es`, entonces ningún switch contiene «Depor ABANCA» ni «As Celtas» ni
  otro nombre de equipo, y `CompetitionPreferenceItem` pierde `featuredBadge`.
  **Enmienda SPEC-057 CA-3** (que exigía esas etiquetas). Igual en
  `CompetitionNav`: sus pills enlazan a una liga y salen las dos etiquetas y
  `.featuredTeamTag`; el equipo destacado sigue en `CompetitionHeader`.
- **CA-2 Colores de liga desde tokens.** `CompetitionMetadata` pierde `color` y
  `accentColor` (este no lo lee nadie; `src/model` no importa de `src/design`).
  `CompetitionHeader`, `CompetitionNav` y `DirectosView` pintan
  `var(--liga-<id>)` vía `LEAGUE_COLORS`. `GalicianClub` pierde `colors` (sin
  consumidores). Test: el `style` de cada punto y barra es `var(--liga-<id>)`.
- **CA-3 Guarda ampliada.** `no-hex.test.ts` aplica el patrón `rgb(`/`rgba(`/
  `hsl(`/`hsla(` también a `src/**/*.{ts,tsx}`, salvo `src/design/tokens.ts` y
  los `*.test.ts(x)`. Hoy fallaría con `competitions.ts` y `clubs.ts`.
- **CA-4 Estado vacío por ligas.** Dada una xornada con partidos y ninguno de
  las ligas elegidas (p. ej., `Feminino` en `/demo/xornada`), cuando se aplica el
  preset **o se recarga con esa preferencia guardada**, entonces se ve
  `data-testid="xornada-empty"` con `xornada.leaguesEmpty` (gl «Ningunha das
  túas ligas xoga nesta xornada. Cámbiaas en ⚙ Ligas.», es «Ninguna de tus
  ligas juega en esta jornada. Cámbialas en ⚙ Ligas.»), paridad gl/es. Si
  el vacío viene del filtro de estado, sigue `xornada.empty`. Al volver a
  `Todas`, el mensaje se oculta. e2e en gl y es, con y sin recarga. Sin
  artboard: entrada en `HERENCIA.md` (estilo `.empty` actual, sin color nuevo).
- **CA-5 Global sin gl·es.** `Global.tpl.html` no dibuja `gl·es` en la
  cabecera (comentario `SPEC-082`, como `Escritorio.tpl.html`); `node build.mjs`
  regenera los `.dc.html` y `git diff` solo cambia `Global.*`. Entrada
  `2026-11-xx (SPEC-083 CA-5)` en `HERENCIA.md`.
- **CA-6 Ledgers con id.** Los ledgers de SPEC-050, 051, 057, 058, 059, 060 y
  062 abren con frontmatter `id`/`tipo: ledger`/`epica` (modelo: SPEC-082).
  En el de SPEC-057, los títulos de las matrices y veredictos RED de la 1ª y
  2ª ronda llevan «(superada: ver 3ª ronda, GREEN)».
- **CA-7 Estados válidos.** `estado.mjs` no admite un estado actual desconocido,
  así que se corrige a mano solo la etiqueta inválida, en `estado` y en su
  entrada de historial (misma fecha y firma):
  SPEC-059 `feito` → `en-revision` (aprobada por el titular, PR #107 en main;
  el implementador declaró fin sin verificador). SPEC-062 `implementada` →
  `bloqueada` (nunca aprobada; código en main, 40f1aa6). Después, solo por
  `estado.mjs` y fuera de esta spec: SPEC-059 la verifica sdd-verificador
  (→ `hecho`); SPEC-062 la aprueba a posteriori el titular
  (`bloqueada → aprobada --por "Alberto Fojo"`), luego `en-progreso`,
  `en-revision` y verificación.
- **CA-8 Cierre.** `valida.mjs` da 0 errores; `npm run gates` y Playwright en
  verde; versión `patch`; sin `font:` ni hex nuevos bajo `src/`.

## Entidades y reglas afectadas
D-8 (`docs/diseno/` manda), `Competition` (dominio.md), SPEC-057 (enmendada en
CA-3), SPEC-082 CA-8 (`gl·es` en el pie), ADR-028 (versión).

## Fuera de alcance
Verificar SPEC-059/062 y llevarlas a `hecho`. Nuevos colores de liga. Botón
«Ver todas» en el estado vacío.

## Notas para el gate humano
- CA-2 cambia el color visible de las cinco ligas masculinas en nav, cabecera
  de competición y `/directos` (p. ej. 1ª División `#FF4B4B` → `#EF4444`):
  manda el token de SPEC-057.
- CA-1 quita también las etiquetas de `CompetitionNav` (decisión del arquitecto).
- CA-7 reescribe una entrada de historial; es la única vía, `estado.mjs` no
  parte de un estado desconocido.
- Si no cabe en un PR: SPEC-083 = CA-1..5 y 8; SPEC-084 = CA-6..7 (solo docs).
