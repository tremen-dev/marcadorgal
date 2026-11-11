---
id: SPEC-084
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-11, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-implementador}
---
# SPEC-084 — Provisional fuera de la portada y explicado en el aviso legal

## Problema
El titular (2026-11-11): la leyenda «* provisional: dato dunha soa fonte, aínda
sen confirmar», al pie de la lista (SPEC-034 CA-3, modo `mark`), ensucia la
home. Decisión del titular, cerrada: `PROVISIONAL_DISPLAY` pasa de `"mark"` a
`"hidden"` (modo ya definido en SPEC-034 CA-4) y la explicación va al aviso
legal. Enmienda SPEC-034: **CA-5** (valor inicial `mark`), **H-2** (`mark` por
defecto; `hidden` «no es el inicial», H-4) y **CA-6** (e2e del modo por defecto
con glifo y leyenda).

## Usuarios / roles afectados
Público de `/`, `/es`, `/aviso-legal`, `/es/aviso-legal`, móvil y escritorio.

## Criterios de aceptación
Solo presentación y texto legal: cualificador, `PublicMatch`, Realtime y motor
no cambian. Sin dependencias ni migración.
- **CA-1 Modo por defecto `hidden`.** Dado `src/app/config.ts`, entonces
  `PROVISIONAL_DISPLAY === "hidden"`; `src/app/config.test.ts` lo afirma (sigue
  siendo uno de `PROVISIONAL_DISPLAYS`) y cita SPEC-084.
- **CA-2 Portada limpia (SPEC-034 CA-4).** Dada la xornada con filas
  `provisional` en `live` y `finished`, en gl y es, 390 y 1440 px, con y sin JS,
  cuando se pinta en el modo por defecto, entonces: ningún `provisional-mark`,
  ningún `match-qualifier` ni texto `qualifier.provisional` (visible o `srOnly`)
  en esas filas, ningún `provisional-legend` en el DOM; `data-qualifier="provisional"`
  sigue en el `li`; las filas `sen_sinal` llevan su etiqueta (D-9).
- **CA-3 Tres modos en e2e por parámetro.** La demo (`/demo/xornada`,
  `/es/demo/xornada`, solo donde `isDemoAvailable`) acepta `?provisional=label|mark|hidden`;
  valor ausente o inválido → `PROVISIONAL_DISPLAY`. `e2e/xornada-provisional.spec.ts`
  recorre los tres modos con esa ruta y conserva todas las aserciones previas
  de `mark` (glifo, color ámbar, `aria-hidden`, leyenda que sigue a filas
  visibles con «Rematados»/día, sin JS) y de `label`, más las de CA-2 para
  `hidden`. Ningún test unitario (`provisional.test.ts`, `qualifier.test.ts`,
  render de `MatchRow`/leyenda) pierde casos: los que asumían el defecto pasan
  el modo explícito. Test: el resolutor del parámetro, tabla valor → modo.
- **CA-4 Párrafo en el aviso legal.** Dadas `/aviso-legal` y `/es/aviso-legal`,
  entonces hay un párrafo, gl y es con el mismo sentido, que dice que algunos
  resultados son provisionales: dato de una sola fuente, todavía sin confirmar,
  que se corrige si la fuente lo cambia. Vive donde viven hoy los textos
  legales (`src/lib/legal/content.ts`, SPEC-058 CA-5), sube `lastUpdated` del
  aviso legal en gl y es, y `content.test.ts` comprueba su presencia en ambas
  lenguas. Sin hex ni `font:` nuevos.
- **CA-5 Gates.** `npm run gates`, `npm run e2e` (Playwright) en verde. `git diff
  origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase`
  vacío. Sin subida de versión: el PR #137 ya sube a 0.10.1 con SPEC-083 y la
  regla es una subida por PR (ADR-028).

## Entidades y reglas afectadas
Cualificador (`dominio.md`: ya admite `hidden` «según el modo de SPEC-034»,
sin cambio). RN-02 (el cierre forzoso sigue marcando `provisional`; solo deja
de pintarse). RN-11 (frescura: sin cambio). D-9 (`sen_sinal` conserva
etiqueta). SPEC-034 CA-5/CA-6/H-2, SPEC-058 CA-5 (lista contenidos del aviso
legal, no fija su texto literal: se amplía, no se contradice). ADR-028.

## Fuera de alcance
Cuándo una Decision es `provisional`; quitar los modos `label`/`mark`; otras
páginas legales; la errata «reconciled multiffuente» del apartado 4 gl.

## Notas para el gate humano
- **H-1 Parámetro de demo.** Es el único sitio donde el modo se elige por URL,
  y solo en entornos con demo (no en producción). Alternativa: e2e solo de
  `hidden` y `mark`/`label` en tests de render; pierde la cobertura sin JS.
- **H-2 Rama.** Se implementa en `ft/SPEC-083-…` (PR #137), no en
  `ft/SPEC-084-…`, por decisión del titular.
- **H-3 Accesibilidad.** En `hidden` tampoco lo oyen los lectores de pantalla
  (SPEC-034 CA-4); la única explicación pública es el aviso legal.
