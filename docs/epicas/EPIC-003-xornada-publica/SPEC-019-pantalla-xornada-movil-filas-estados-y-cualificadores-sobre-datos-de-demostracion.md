---
id: SPEC-019
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-06, por: sdd-arquitecto}
---
# SPEC-019 — Pantalla Xornada móvil: filas, estados y cualificadores sobre datos de demostración

## Problema
`board` tiene el marcador correcto y nadie lo ve (EPIC-003). Antes de exponer
datos (ADR-014, en gate) hay que fijar **qué se pinta y cómo**: el contrato
público de un partido y la pantalla Xornada móvil de `docs/diseno/` (D-8,
ADR-005) con los cinco estados y los tres cualificadores, sin que ninguno se
diga solo con color. Esta spec lo hace sobre datos de demostración, sin base
de datos, para que SPEC-020 solo tenga que enchufar `board`.

## Usuarios / roles afectados
- Público: todavía nadie; la ruta de demostración no existe en producción.
- SPEC-020 y la de Realtime heredan `PublicMatch` y el modelo de vista.

## Criterios de aceptación
- **CA-1 `PublicMatch`.** `src/model/public.ts` exporta el esquema zod con los campos de ADR-014 §3: `matchId`, `competitionId`, `competitionName`, `tier`, `round`, `kickoff`, `home` y `away` (`name`, `shortName` nulable), el estado como `MatchState` (`src/model/state.ts`), `qualifier`, `version` (entero ≥ 0; 0 sin Decision), `observedAt` y `decidedAt` (`Instant` nulables). Test: acepta un ejemplo de cada uno de los cinco estados; rechaza claves extra (`sourceId`, `rule`, `observationIds`) (no se descartan en silencio); rechaza `live` sin marcador y `scheduled` con marcador.
- **CA-2 Modelo de vista puro.** `src/xornada/view.ts` exporta `buildXornada(matches: PublicMatch[])` → competiciones en el orden de H-1, cada una con su número de partidos `live` y sus filas en el orden de H-2 (empate: `kickoff`, luego `matchId`). Cada fila trae: nombres a mostrar (`shortName ?? name`), marcador o `null`, contenido del margen (`time` con el `kickoff`, `minute` con minuto y añadido, o `status`), clave i18n del estado, clave del cualificador cuando no es `confirmado`, y ganador en `finished`. Test de tabla con un caso por estado × cualificador permitido, el orden de competiciones y filas, `45+3` frente a `46`, `live` con `minute: null` (margen `status`, «En xogo») y empate sin ganador. `src/xornada/` solo importa de `src/model` (test de arquitectura como `sources-boundary`).
- **CA-3 Fila según el diseño.** Componentes servidor en `src/components/xornada/` reproducen la cabecera de competición (nombre, píldora con el número en xogo y su etiqueta accesible) y la fila ampla de `Movil.tpl.html`, con tokens de `src/design/tokens.ts` y la semántica de ADR-005: `live` con punto e inserto ember y el minuto; `sen_sinal` con la etiqueta «sen sinal» en rojo (en `live` y en `scheduled`); `postponed` y `suspended` con su etiqueta en ámbar; `provisional` con su etiqueta; marcador «–» en `scheduled` y `postponed`. Literales de `dominio.md`, nunca `FIN`, `APR`, `DESC`, `?` ni `!`. Playwright sobre la ruta de CA-5: cada fila no `scheduled` contiene en su texto la etiqueta de su estado o su minuto, y cada fila con cualificador no `confirmado` contiene la etiqueta del cualificador; los marcadores tienen `font-variant-numeric` con `tabular-nums` (como `e2e/digits.spec.ts`).
- **CA-4 Nada se trunca (D-2).** Playwright a 360 y 390 px: ningún nombre de equipo ni de competición tiene `scrollWidth > clientWidth`, la página no tiene scroll horizontal y los nombres no llevan `text-overflow: ellipsis`. La demostración incluye «Terceira Federación · Grupo 1», «Bilbao Athletic» y un equipo sin `shortName`.
- **CA-5 Ruta de demostración.** `/demo/xornada` (gl) y `/es/demo/xornada` (es) pintan `buildXornada` sobre `src/xornada/demo.ts`: `PublicMatch[]` validado con el esquema, con las cinco competiciones de D-3, nombres reales del calendario declarado y todos los casos de CA-2. Responde 404 cuando `VERCEL_ENV === 'production'` (función guarda con test unitario) y lleva `robots` `noindex`. Sin JavaScript (`javaScriptEnabled: false`) pinta las mismas filas: es contenido servidor.
- **CA-6 gl/es.** Todo texto visible sale de `src/i18n/` (claves nuevas en `gl.ts` y `es.ts`, paridad por tipo). En `/es/demo/xornada` estados y cualificadores salen en castellano y nombres de equipo y competición son idénticos a gl. El selector gl·es de la cabecera enlaza a la ruta equivalente de la otra lengua. Horas en `Europe/Madrid` con `formatTime`.
- **CA-7 Gates.** `npm run gates` y `npm run e2e` en verde. Sin dependencias nuevas. `git diff main --stat -- src/sources src/decide src/ingest supabase` vacío. Ni hex sueltos ni shorthand `font:` (tests existentes de `src/design/`).

## Entidades y reglas afectadas
Board, Estado de partido, Cualificador, Xornada, Team (`shortName`, N-11) de
`dominio.md`. RN-05 y ADR-013 §2 (`sen_sinal` también en `scheduled`). D-2,
D-8, D-9. ADR-005 (semántica de color y excepciones 1-4). ADR-014 §3.

## Fuera de alcance
- Leer `board`, snapshot en `/`, `/api/board`, caché: SPEC-020 (ADR-014).
- Tira de días, filtros (Todos · Directo · Rematados), plegar competición,
  escritorio: spec propia. Búsqueda, ★, modo Global y barra inferior: fuera de
  v1 (FOUNDATION, ADR-005 exc. 4).
- Frescura por fila (RN-11) y aviso de conexión: spec de Realtime; necesita
  reloj vivo.
- **Descanso**: el modelo no lo distingue (SPEC-005 N-7: `HT` es `live`, 45 y
  su añadido). Aquí se pinta el minuto que da `board`. Ver N-1.

## Notas para el gate humano
- **H-1 Orden de competiciones.** *Recomendado:* Terceira → Segunda Fed. →
  Primeira Fed. → Segunda → Primeira («lo gallego arriba», `vision.md`, como
  la demo del diseño). Alternativa: por `tier` ascendente.
- **H-2 Orden de filas.** *Recomendado, como el diseño:* en xogo, rematados,
  suspendidos, programados, aprazados. Alternativa: solo por `kickoff`
  (las filas no saltan al empezar un partido).
- **N-1 Descanso.** La épica pide «`live` (con descanso)» y hoy un partido en
  descanso se ve como `45+3'` quieto. Distinguirlo toca adaptador, columna y
  motor: propongo spec aparte en EPIC-003 (desglose, orden 3). Decidid si
  entra aquí o se acepta el `45+n'`.
- **N-2** `PublicMatch` es el contrato que ADR-014 §3-§5 publica; si el gate
  del ADR quita o añade un campo, se enmienda CA-1 antes de implementar.
