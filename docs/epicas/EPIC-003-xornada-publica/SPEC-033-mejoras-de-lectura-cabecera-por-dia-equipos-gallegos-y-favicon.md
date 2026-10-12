---
id: SPEC-033
tipo: spec
epica: EPIC-003
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-12, por: Alberto Fojo}
---
# SPEC-033 — Mejoras de lectura: cabecera por día, equipos gallegos y favicon

## Problema
El titular, usando la pantalla (2026-10-12): (1) «los partidos no sé de qué día
son, sólo aparece su hora […] da la sensación de desordenados»: la fila de un
`scheduled` solo lleva la hora y las filas se ordenan por estado (SPEC-019 CA-2,
H-2), no por fecha; (2) «estaría bien que los equipos de galicia estuvieran en
otro color […] o con alguna marca distintiva»: hoy no hay dato de qué equipo es
gallego (`PublicTeam` solo trae `name` y `shortName`, ADR-014 §3); (3) «la
página no tiene favicon». El `provisional` va aparte, en SPEC-034.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS.

## Criterios de aceptación
Sin lecturas nuevas en `web.xornada`, sin migración, sin dependencias.
- **CA-1 Orden cronológico (puro, enmienda SPEC-019 CA-2/H-2).** `buildXornada` ordena las filas de cada competición por `kickoff` y luego `matchId`; el estado deja de ordenar. Cada competición expone sus filas agrupadas por `day` (SPEC-023 CA-1) en fechas ascendentes. Test de tabla: los cinco estados mezclados salen por `kickoff`; dos días; un `live` de otra ronda va en su día; el caso del cambio de hora de SPEC-023 CA-1.
- **CA-2 Cabecera por día (H-1, H-2).** En cada competición, antes del primer partido de cada día, una cabecera discreta con `xornada.dayHeader` = «{weekday} {day} {month}» (gl «sáb 11 out», es «sáb 11 oct»), también si la competición juega en un solo día. Letra `TYPE.eyebrow`, color `--fg-muted`, alto `MEASURE.rowCompact`, sin fondo propio; hoy en mayúsculas como en la tira (SPEC-023 CA-2). Es un encabezado accesible (`getByRole('heading')` de nivel inferior al de la competición), no `aria-hidden`.
- **CA-3 Cabecera y filtros.** Con JS: con un día elegido en la tira (`#d=`), las cabeceras de día se ocultan con `hidden` (H-1); con un filtro de estado, el grupo de un día que queda vacío se oculta con su cabecera; quitar el día o el filtro las restaura. Sin JS se ven todas. Un repintado de SPEC-024 conserva cabeceras, plegado y filtro (SPEC-023 N-2).
- **CA-4 Equipo galego declarado (H-3, H-4).** `data/galegos/<temporada>.json`: lista de `TeamId` validada con un esquema zod en `src/model`. Test: sin duplicados; todo id existe en algún `teams` de `data/calendario/<temporada>/`; los `name` de la temporada son únicos entre los cinco calendarios. 2026-27 declara 31: Primeira 2 (RC Celta, RC Deportivo), Segunda 1 (Celta Fortuna), Primeira RFEF 5, Segunda RFEF 5, Terceira 18. En servidor se resuelven a nombres, todos sin excepción (también los de una competición entera gallega como Terceira G1, H-4), y el conjunto llega a `buildXornada` como parámetro (`src/xornada/` sigue sin importar de `data/`, SPEC-019 CA-2). Cada fila trae `homeGalician`/`awayGalician`. El cliente de SPEC-024 recibe el mismo conjunto en props; el delta de Realtime no cambia.
- **CA-5 Marca visual (H-5).** Nombre de equipo gallego: `font-weight: 600` y color `--marca`; si pierde (`finished`) o el partido es `postponed`, `--marca-deep` en vez del apagado de SPEC-019. Por clase con tokens; sin hex. No es un estado (ADR-005: verde = marca), así que no lleva etiqueta.
- **CA-6 Favicon e iconos (H-6).** A partir de la semilla de icona elegida de `docs/diseno/Marca.dc.html` (retícula de 48), con fondo `--bg` y la marca en `--marca` tomados de `COLORS`: `/favicon.ico` (16 y 32 px), `<link rel="icon">` de 32 px y `apple-touch-icon` de 180 × 180 PNG en el `<head>` de `/`, `/es`, `/xornada/[fecha]` y demos. Playwright: cada `href` responde 200 con tipo de imagen y las medidas dichas; ninguna petición de icono da 404. Capturas a 16, 32 y 180 px en `_qa/SPEC-033/`.
- **CA-7 Diseño y matriz e2e.** Playwright en `/demo/xornada` y `/es/demo/xornada`, 360/390/1024/1440 px, con y sin JS: filas en orden de `kickoff` y cabeceras de CA-2/CA-3; la demo tiene un gallego contra no gallego en Primeira con el gallego perdedor, uno en `postponed` y filas de Terceira con marca en sus dos equipos; en los nombres marcados, `getComputedStyle` da peso 600 y el color del token. Nada se trunca (D-2), sin scroll horizontal, textos solo de `src/i18n/` (paridad gl/es), ningún `font:`, ningún hex fuera de `tokens.ts` (tests de `src/design/`).
- **CA-8 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde; tests de SPEC-019 CA-2 actualizados al orden de CA-1. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío.

## Entidades y reglas afectadas
Xornada, Team, Calendario declarado (`dominio.md`); término nuevo «Equipo
galego» (H-3). D-2, D-3, D-8. ADR-005 (verde solo marca), ADR-014 §3 (sin
cambios: el dato no viaja en `PublicMatch`). **Enmienda SPEC-019 CA-2 y H-2**
(orden de filas). SPEC-023 CA-1/CA-2/N-2, SPEC-024, SPEC-028.

## Fuera de alcance
`provisional` (SPEC-034); manifiesto web/PWA y `theme-color`; leyenda de qué
significa el verde; marca de agua; caché de la portada (SPEC-030).

## Notas para el gate humano
- **H-1 Sin cabecera de día con un día elegido.** Recomendado: la tira ya dice el día y la cabecera repetiría lo mismo encima de cada competición. Alternativa: mantenerla siempre (más simple, una línea más por competición). El titular dijo «podemos hablarlo».
- **H-2 Cronológico puro y cabecera también con un solo día.** Recomendado: el problema es no saber el día. Efecto: el `live` deja de subir arriba (SPEC-019 H-2); queda en su hora, con su ember y su píldora en la cabecera.
- **H-3 Dónde se declara «gallego».** **A (recomendada) — lista de ids en `data/galegos/<temporada>.json`**, resuelta a nombres en servidor y casada por `name` (único, test de CA-4): sin migración, sin tocar `PublicMatch` ni Realtime; se corrige editando un JSON, como el calendario. **B — columna `teams.galician`** cargada del calendario y expuesta en `web.xornada`: dato en la base, pero migración, cambio de la superficie de ADR-014 §3 (pide ADR) y del delta. Al aprobar, sdd-arquitecto añade «Equipo galego» a `dominio.md`.
- **H-4 Se marca todo equipo gallego, también en Terceira G1.** Sus 18 equipos lo son y todas sus filas irán marcadas: la regla es la lista, sin excepciones por competición. Alternativa descartada: no marcar una competición entera gallega.
- **H-5 Gallego que pierde.** El ganador ya va en 600 y el perdedor apagado (SPEC-019): un gallego perdedor en verde y negrita parecería ganador. Recomendado: `--marca-deep` para el gallego perdedor o aplazado. Alternativa: verde siempre y que lo diga el marcador.
- **H-6 Qué icono.** El diseño tiene tres semillas sin elegir (Marca: A «Dúas liñas», B «O bloque», C «A matriz»). Recomendado **B**: es el ▮ del logotipo y sobrevive a 16 px; C pierde los puntos apagados a 16 px (lo dice el diseño). Es decisión de marca: si se elige otra, CA-6 no cambia.
- **Resolución del titular (2026-10-12, Alberto Fojo):** H-1, H-2, H-3 (A),
  H-5 y H-6 (B), como se recomiendan. H-4: rechaza la exclusión por
  competición; se marcan todos los equipos gallegos, también en Terceira G1.
