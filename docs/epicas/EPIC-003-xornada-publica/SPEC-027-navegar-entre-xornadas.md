---
id: SPEC-027
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-09, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-09, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-09, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-10, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-10-10, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-10-10, por: sdd-verificador}
---
# SPEC-027 — Navegar entre xornadas

## Problema
`/` y `/es` solo sirven la xornada actual (SPEC-020 CA-5, H-1): desde el
miércoles por la tarde desaparecen los resultados del fin de semana y no hay
forma de volver a ellos. SPEC-023 H-2 dejó fuera las flechas ‹ › del diseño
porque `currentRound` no responde «qué es la xornada anterior»: las rondas de
cada competición no van sincronizadas (rondas entre semana, parones distintos) y
un aplazado juega fuera de su semana. Esta spec define ese conjunto, su URL y
las flechas.

## Usuarios / roles afectados
- Público: vuelve a los resultados de semanas pasadas y ve el calendario de las siguientes, en gl y es, con y sin JS.

## Criterios de aceptación
Mismas lecturas que hoy: `index(season)` y `matches(ids)` del lector público; **sin migración** (N-1).
- **CA-1 Semana de xogo (puro, H-1).** `src/board/weeks.ts`, sin reloj: la semana de un instante es la ventana martes 00:00 → martes 00:00 `Europe/Madrid` que lo contiene y su clave es el sábado de esa ventana (`AAAA-MM-DD`). La semana de una ronda (competición + `round`) es la de su mediana de kickoffs (la misma de `currentRound`). `weekXornada(index, semana)` = todos los partidos de las rondas cuya semana es esa, sea cual sea su estado (sin la regla de `live` de otra ronda). `seasonWeeks(index)` = semanas con al menos una ronda, ascendentes. Test de tabla: ronda viernes-luns → su sábado; partido del lunes y luns 23:59 frente a martes 00:00; cambio de hora (2026-10-25); ronda del miércoles y ronda del fin de semana de una competición → las dos en la misma semana; aplazado de J3 jugado en la semana de J8 → sigue en la de J3; competición en parón → ausente; índice vacío → `[]`.
- **CA-2 Semana de la portada y destinos (puro, H-3).** `homeWeek(index, now)` = la mayor semana de las rondas que elige `currentRound` por competición (SPEC-020 CA-5). Vecinas = semana de `seasonWeeks` inmediatamente anterior / posterior (las vacías se saltan); en `/` son las de `homeWeek`. El destino es `/` (`/es`) si la semana es `homeWeek` y `/xornada/<semana>` (`/es/xornada/<semana>`) si no; sin vecina, `null`. Test de tabla: sábado de J5 → ‹ semana de J4, › semana de J6; miércoles tras el punto medio en todas → ‹ = semana del fin de semana jugado; miércoles mixto (Primeira ya en la siguiente, Terceira no) → `homeWeek` = la siguiente y ‹ trae Primeira J8 y Terceira J6; parón de todas → se salta; primera y última semana → `null`; simetría: para toda semana W ≠ `homeWeek` con anterior, la siguiente de su anterior es W.
- **CA-3 Ruta (H-2, H-5).** `/xornada/[fecha]` y `/es/xornada/[fecha]` pintan `XornadaScreen` con `buildXornada` sobre `weekXornada` de la temporada de `now` (`seasonOf`), en servidor, con el selector gl·es apuntando al par. Una función pura decide la respuesta y tiene test de tabla: `fecha` que no es una fecha válida `AAAA-MM-DD` → 404; fecha válida que no es la clave de su semana → 308 a la clave (mismo idioma); semana = `homeWeek` → 307 a `/` (`/es`); semana fuera de `seasonWeeks` de la temporada de `now` → 404; sin `DATABASE_URL_PUBLIC` o lectura fallida → `xornada.unavailable` y cero filas, como `/`. `robots` `noindex, nofollow` como `/`. `e2e:db` sin JS: las filas son exactamente `weekXornada`, ninguna de otra semana, nombres idénticos en gl y es.
- **CA-4 Caché (ADR-014 §6).** Cada `/xornada/[fecha]` es ISR de 10 s bajo demanda (sin prerender en build) y sirve `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`, igual que `/`. `curl -I` contra `next start` en el ledger: 200 con esas directivas, 308 y 307 con su `Location`, 404. `npm run build` pasa sin `DATABASE_URL_PUBLIC`. `/api/board` no cambia.
- **CA-5 Sin directo fuera de la portada (H-4).** En `/xornada/[fecha]`, con el interruptor de SPEC-024 apagado y encendido: ninguna petición a `/api/board`, ningún WebSocket ni chunk de `supabase-js`. La línea de frescura de SPEC-024 CA-8 dice «Actualizado ás HH:MM» servida y, en cliente, «hai N min» desde ese instante; nunca «Sen tempo real» ni «Sen conexión». Día, filtro y plegado funcionan como en SPEC-023 (CA-4, CA-5, CA-9 repetidos en una página de semana). `/` y `/es` siguen igual (e2e de SPEC-024 en verde).
- **CA-6 Flechas ‹ › (D-8, H-6).** En la tira (40 px móvil; barra de 44 px en escritorio), ‹ antes del primer día y › después del último, fuera de la zona que desplaza. Cada una es un `<a href>` al destino de CA-2, con `aria-label` i18n `xornada.previous` / `xornada.next` (gl «Xornada anterior» / «Xornada seguinte», es «Jornada anterior» / «Jornada siguiente») y el glifo `aria-hidden`; no llevan el fragmento. Sin destino, en su lugar va un hueco del mismo ancho, `aria-hidden` y fuera del orden de tabulación. Objetivo táctil ≥ 24 px (ADR-005 exc. 6), colores por tokens, contorno de foco visible. Playwright en `/`, `/es` y una página de semana (gl y es; 360, 390, 1024 y 1440 px; con y sin JS): flechas visibles, sin truncado ni scroll horizontal (D-2), alcanzables con teclado; sin JS, ‹ en `/` lleva a la semana anterior y su › vuelve a `/`; en la primera semana de la temporada no hay enlace ‹.
- **CA-7 Gates.** `npm run gates`, `e2e`, `e2e:db` y `test:db` en verde; sin dependencias nuevas; tests de `currentRound` y `currentXornada` sin cambios. `git diff origin/main --stat -- src/sources src/decide src/ingest supabase src/app/api src/board/http.ts src/board/reader.ts` vacío (`current-round.ts` puede exportar su mediana sin cambiar su comportamiento).

## Entidades y reglas afectadas
Xornada, Match (`dominio.md`: la xornada sigue siendo la ronda de una
competición; la semana es solo clave de navegación). D-2, D-8, D-9. ADR-005
(exc. 6), ADR-014 §3, §4 y §6 y ADR-015 (sin cambios). SPEC-020 CA-5/CA-6
(`currentRound`, `seasonOf`, snapshot), SPEC-023 (tira, fragmento, H-2),
SPEC-024 CA-6-CA-8 (cliente, frescura).

## Fuera de alcance
Temporadas pasadas; ir a una ronda concreta o a una fecha con selector;
`/api/board` por semana, polling o Realtime fuera de `/`; indexar; SEO.

## Notas para el gate humano
- **H-1 «Xornada N±1» = semana de xogo martes-luns por mediana de ronda.** Recomendado: estable, compartible y es lo que se busca («o fin de semana pasado»). Descartadas: (b) ronda ±1 por competición desde la portada: la URL cambia de sentido el miércoles; (c) «la portada en la fecha D» (`currentRound` en D): estados mezclados de pocas horas y el jueves vuelve a la misma ronda (SPEC-023 H-2). Efecto: una competición con ronda entre semana muestra dos rondas en la misma página; la cabecera dice «xornada N» de la más frecuente (SPEC-023 CA-1).
- **H-2 URL por fecha, clave el sábado:** `/xornada/2026-10-03`; cualquier otro día de la semana redirige (308), así hay una entrada de caché por semana. No hay número de ronda común entre competiciones. Recomendado.
- **H-3 La semana de la portada no tiene página: es `/`** (307, y las flechas que irían a ella van a `/`). Evita una copia congelada de la semana en directo. «Mayor semana» resuelve el miércoles mixto: ‹ trae a la vez lo jugado por todas. Recomendado.
- **H-4 Fuera de `/`, snapshot ISR sin polling ni Realtime**, con frescura honesta (D-9). Alternativa: `/api/board?semana=` (otra clave de CDN, más alcance). Recomendado sin.
- **H-5 Límites: solo la temporada de `now`, hacia atrás y hacia delante** (las futuras muestran el calendario en `scheduled`); fuera, 404; semanas sin partidos se saltan. Recomendado.
- **H-6 Las flechas no llevan el fragmento:** el día elegido no existe en otra semana; el filtro se pierde a propósito. Recomendado.
- **N-1 Sin migración ni ADR.** El lector ya lee toda la temporada (`index`) y las filas por id; `web_reader`, `web.xornada` y `/api/board` sin tocar. Carga: ≤ 1 lectura por ruta visitada, región y 10 s (ADR-014 §6), ~40 semanas.
- **N-2** Un `live` de una semana pasada (aplazado de esa ronda) se ve allí como snapshot de ≤ 10 s y en `/` en directo (SPEC-020 H-2).
- **N-3** Las flechas de `/` se calculan al servir: con la pestaña abierta del martes al miércoles tarde, ‹ apunta una semana atrás de más hasta recargar (la semana saltada sigue a un ›). Aceptable en v1.
- **Decididas por el titular (Alberto Fojo, 2026-10-09):** H-1..H-6 según recomendación (semana de martes a lunes por mediana de cada ronda; URL por fecha con clave en el sábado; la semana de la portada es `/`; semanas fuera de `/` sin polling ni Realtime; solo la temporada en curso; las flechas no llevan el fragmento). Spec aprobada.
- **Salvedades aceptadas por el titular (Alberto Fojo, 2026-10-10):** F-1 (`Location` duplicada en el primer render de Next 16.3.5; se comprueba en Vercel tras el despliegue), F-2 (404 y redirecciones con `s-maxage=10`) y F-4 (una temporada S-(S+1) no tiene rondas fuera de esos dos años civiles).
