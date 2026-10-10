---
id: SPEC-030
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
---
# SPEC-030 — La portada sirve una instantánea ISR antigua

## Problema
`/` y `/es` son ISR (`revalidate = 10`, `expireTime: 40`; SPEC-020 CA-7). Tras
≥ 40 s sin peticiones en un nodo de la CDN, la siguiente recibe el **HTML
prerenderizado en el build** del último despliegue (`x-vercel-cache:
PRERENDER`, `age: 0`) mientras Vercel regenera detrás. Su edad no tiene cota:
la del último despliegue.
**Daño ya hecho:** 2026-10-10 15:07:59Z, primera pintura de `/` con el HTML del
build de las 13:57Z (merge del PR #60): Alavés-Atlético «16:15 Programado»
cuando `board` lo daba `live` 1-1 en descanso (`_qa/SPEC-021/ca9-fila.txt`,
`ca9-descanso-produccion.png`). Reproducido en solo lectura: tras 45 o 65 s de
inactividad, siempre PRERENDER «ás 17:38» (build de #61), y a las 20:44Z, cinco
horas después, con 4 partidos en juego donde había 3 y `version` 101 donde había 113.
Con tráfico cada 5 s, correcto. Sin variantes por cabecera de petición: la
hipótesis inicial queda refutada (`_qa/SPEC-030/sondeo-2026-10-10.md`).
D-9 se cumple (la línea dice la hora real), pero falla el criterio 2 de
EPIC-003 hasta que llega el polling (30-45 s), y SPEC-025/026 miden sobre ese
HTML. **Plazo:** antes de la jornada publicada. Con poco público, casi todas
las visitas son «la primera tras inactividad».

## Usuarios / roles afectados
- Espectador de `/` y `/es` sin tráfico previo en su nodo de la CDN.
- Sondas de SPEC-025 y SPEC-026, que leen la primera pintura.

## Criterios de aceptación
- **CA-1 Portada dinámica con caché de CDN (H-1 a).** `/` y `/es` pasan a render por petición (`dynamic = "force-dynamic"` o equivalente) y responden `Cache-Control: public, s-maxage=10, stale-while-revalidate=30` (`BOARD_CACHE_CONTROL`), sin `x-nextjs-prerender` ni `x-nextjs-cache`. El `next build` las lista como dinámicas (`ƒ`), no como ISR. `curl -I` contra `next start` en el ledger. Si Next pisa la cabecera en una página dinámica, el implementador la fija por la vía que funcione (`headers()`, `proxy.ts`) y lo anota.
- **CA-2 Nada del build en la portada.** El HTML de `/` y `/es` no sale del build: el artefacto no trae `/index.html` ni `/es.html` prerenderizados. Test sobre la salida de `next build` (`.next/server/app`) o el manifiesto de prerender: `/` y `/es` ausentes de `prerender-manifest.json` `routes`. `npm run build` sigue pasando sin `DATABASE_URL_PUBLIC`.
- **CA-3 Puesta al día al hidratar (H-2).** Si `servedAt` (instante de render que ya viaja en `live`, SPEC-024) es más antiguo que 45 s según el reloj del navegador, el cliente pide `/api/board` nada más hidratar, sin esperar al primer ciclo de polling. Con 45 s o menos, no. Test con reloj y `fetch` dobles: 44 s → ninguna petición inmediata; 46 s → una, con `If-None-Match` y `cache: "no-store"`. Las demos no piden nada.
- **CA-4 Reproducción en campo.** `tools/cache-portada.mjs` (sin dependencias nuevas): N rondas (por defecto 5) de «espera 65 s → GET `/` y `/es` sin `Accept-Encoding`». Por respuesta: `x-vercel-cache`, `age`, `date` y la hora de la línea de frescura, en JSONL. Parser puro en `src/medicion/` con test sobre fixtures sacados de `_qa/SPEC-030/` (un PRERENDER con frescura de 5 h → fallo; un MISS con frescura del minuto de `date` → bien). **Cumple** si ninguna respuesta es `PRERENDER` y cada frescura está a ≤ 1 min de su `date`. Corrido en producción tras el despliegue, con salida en `_qa/SPEC-030/` y veredicto en el ledger. Hoy fallan todas las rondas medidas (5 de 5 respuestas tras inactividad, sondeo §3).
- **CA-5 Sin regresiones.** `e2e` sin JS de SPEC-019/020/023 en verde: el HTML sigue trayendo las filas. Los tests de SPEC-024 siguen verdes. `/xornada/[fecha]`, `/api/board`, `expireTime` y ADR-014 §6 sin cambios.
- **CA-6 Gates y fronteras.** `npm run gates` → 0. Sin dependencias nuevas. `git diff main --stat -- src/sources src/decide src/ingest supabase` vacío.

## Entidades y reglas afectadas
Board, Frescura (`dominio.md`); D-9; ADR-014 §6 (las directivas no cambian: la
caché la pone la CDN y no ISR); SPEC-020 CA-6/CA-7; SPEC-024 CA-7/CA-8;
SPEC-025 CA-3; SPEC-026 CA-2/CA-4; SPEC-027 CA-4.

## Fuera de alcance
- `/xornada/[fecha]`. Es ISR bajo demanda y no tiene prerender de build.
  Medido tras 65 s de inactividad: MISS, render bloqueante, fresco
  (sondeo §5). La semana actual redirige a `/`.
- Purga de la CDN al desplegar, y Realtime (SPEC-024 H-6).

## Notas para el gate humano
- **H-1 Mecanismo.** (a) **Recomendada:** portada dinámica, cacheada por la CDN
  con las directivas de hoy. Peor caso: 40 s de antigüedad (10 + 30), y tras
  inactividad, MISS con render fresco. Lecturas a la base: ~1 por región y 10 s
  con tráfico, como hoy con ISR, más una por cada MISS. Coste: el MISS suma el
  render al TTFB (lectura de `web.xornada`), y SPEC-026 lo medirá en CA-4.
  (b) Mantener ISR y que solo el cliente se ponga al día (CA-3): la primera
  pintura sigue mal hasta 1 RTT y sin JS no se arregla nunca. Además, `Age: 0`
  miente: solo sirve `servedAt`. (c) Quitar `expireTime` (expira en 1 año): sin
  PRERENDER, pero tras inactividad devuelve STALE de la última regeneración,
  que pueden ser horas (de noche): el mismo fallo con otra cota. Rechazada.
- **H-2 CA-3 como cinturón.** Recomendado sí. Son pocas líneas y cubren
  cualquier otra copia antigua (restaurar pestaña, bfcache, un nodo de la CDN
  rezagado). Si se quiere el cambio mínimo de EPIC-FIX, se puede quitar CA-3 y
  quedarse en (a).
- **Sin ADR nuevo.** ADR-014 §6 fija directivas y carga, no ISR. Al aprobar, se
  anota con fecha una enmienda en SPEC-020 CA-7 («/ y /es: dinámicas con caché
  de CDN, no ISR»), sin cambiar su estado.
- **Plan Free (Supabase).** La carga de lecturas no sube de forma apreciable.
  Vercel: una invocación por MISS. A la escala de hoy no cuenta. Si cambia,
  se mira en la jornada publicada.
- **Confirmar en la implementación:** que la CDN de Vercel cachea la página
  dinámica con esas directivas, como se espera de `/api/board` (hoy MISS en el
  sondeo). Si no, PARA y vuelve al gate.
