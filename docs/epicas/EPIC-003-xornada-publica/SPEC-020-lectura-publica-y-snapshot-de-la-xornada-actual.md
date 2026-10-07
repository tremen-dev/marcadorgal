---
id: SPEC-020
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-07, por: sdd-arquitecto}
---
# SPEC-020 — Lectura pública y snapshot de la xornada actual

## Problema
La pantalla de SPEC-019 pinta datos de demostración; `/` sigue siendo la página
de espera y `board` solo se lee como `postgres`. ADR-014 §2-§4 y §6 fijan cómo
lee el público: vista `web.xornada`, rol `web_reader`, sin lectura anónima de
tablas y con caché. Falta además decir **qué** partidos son «la xornada actual»
(no existe como conjunto entre competiciones, ADR-014 §5). Sin Realtime: en
esta spec la pantalla es el snapshot servido y `/api/board`.

## Usuarios / roles afectados
- Público: ve en `/` y `/es` la xornada real (H-3).
- Titular: aplica la migración, pone la contraseña de `web_reader` y la variable en Vercel antes del merge.
- La spec de Realtime hereda `/api/board` (polling) y el lector.

## Criterios de aceptación
Ordenados para desplegar sin romper producción (ver N-1).
- **CA-1 `test:db` en local (ADR-014 §1).** `npm run test:db` aplica las migraciones y corre contra Supabase local; se niega (exit ≠ 0, sin conectar) si el host de su URL no es loopback. `createSql` usa TLS salvo en loopback. Test unitario de la guarda; evidencia: `test:db` en verde con `supabase start`.
- **CA-2 Migración.** Esquema `web` (fuera de `api.schemas` de `supabase/config.toml`) con la vista `web.xornada`: una fila por partido con exactamente las columnas de ADR-014 §3 más `season` (N-2). Sin Decision: `status` `scheduled`, `qualifier` `confirmado`, `version` 0, marcador, minuto, `observed_at` y `decided_at` nulos. Rol `web_reader` con `LOGIN`, sin contraseña en el repo, con `USAGE` en `web` y `SELECT` solo en `web.xornada`. Retira las cinco políticas `public_read` y el `SELECT` de `anon` y `authenticated` sobre `public.board` (supersede ADR-006 §6). Test de base: lista exacta de columnas; como `web_reader`, lee la vista y recibe `42501` en `public.matches`, `decisions`, `observations`, `board`, `alerts` y en cualquier `INSERT`; como `anon` y `authenticated`, 0 filas en las cinco tablas y en `board`, y `42501` en `web.xornada`. Se actualiza la aserción de políticas de `schema.db.test.ts`.
- **CA-3 Contraseña y entorno.** `npm run db:web-reader` pone la contraseña de `WEB_READER_PASSWORD` con `DATABASE_URL` y nunca la imprime (test como el de secretos de `informe`). `.env.example` gana `DATABASE_URL_PUBLIC` y `WEB_READER_PASSWORD`. Evidencia en el ledger: `vercel env ls` (solo nombres) con `DATABASE_URL_PUBLIC` en Production y Preview.
- **CA-4 Lector.** Un único módulo `server-only` lee `DATABASE_URL_PUBLIC` y nunca `DATABASE_URL`; `/`, `/es` y `/api/board` solo importan ese lector (test de arquitectura). Convierte cada fila a `PublicMatch` (instantes ISO con `Z`) y la valida; una fila inválida se omite con `console.error` que nombra el `matchId`, nunca tumba la respuesta. Test de base con semilla: sin Decision, los cinco estados, `live` 45+3, `sen_sinal` en `live` y en `scheduled`, `provisional` → todas pasan `PublicMatch` (F-SPEC-019-3).
- **CA-5 Xornada actual (H-1, H-2).** Función pura `(índice, now) → partidos`: temporada por la regla de `calendario:xornada` (julio); por competición con partidos, la ronda `currentRound` (`src/calendar/current-round.ts`: mediana de kickoffs más cercana a `now`, menor en empate) más los `live` de otras rondas de esa competición. Test de tabla: sábado de J5 → J5; miércoles antes y después del punto medio entre medianas; empate exacto → ronda menor; partido del lunes sigue en su ronda; competiciones en rondas distintas; `live` aplazado de J3 aparece en la vista de J5; competición sin partidos no sale.
- **CA-6 Snapshot en `/` y `/es`.** Pintan `XornadaScreen` con `buildXornada` sobre CA-5, renderizado en servidor; la página de espera sale de `/`. `e2e:db` (Supabase local con semilla, fuera de CI): con `javaScriptEnabled: false` el HTML trae las filas de la xornada actual y ninguna de otra ronda; nombres idénticos en gl y es. En CI, sin `DATABASE_URL_PUBLIC`: mensaje i18n `xornada.unavailable` y cero filas, nunca una xornada vacía. `robots` según H-3.
- **CA-7 `/api/board` y caché (ADR-014 §6).** `GET` → 200 `{ matches: PublicMatch[] }` con la selección de CA-5; `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`; `ETag` fuerte = hash del cuerpo (N-3); `If-None-Match` igual → 304 sin cuerpo; fallo de lectura → 503 con `no-store`. Tests unitarios con lector inyectado. `/` y `/es` sirven las mismas directivas (`curl -I` contra `next start` y contra el preview, en el ledger) y `npm run build` pasa sin `DATABASE_URL_PUBLIC`.
- **CA-8 Gates.** `npm run gates`, `npm run e2e` y `npm run test:db` en verde. Sin dependencias nuevas (ni `@supabase/supabase-js`). `git diff main --stat -- src/sources src/decide src/ingest` vacío.

## Entidades y reglas afectadas
Board, Xornada, Estado de partido, Cualificador (`dominio.md`); RN-05; D-2, D-6,
D-9. ADR-014 §1-§4 y §6 (implementa), ADR-006 §6 (supersedido), ADR-013 §2,
SPEC-019 (`PublicMatch`, `buildXornada`, F-SPEC-019-3), SPEC-004 (`currentRound`).

## Fuera de alcance
- Realtime, trigger `realtime.send`, `supabase-js`, polling y frescura: spec de Realtime.
- Descanso: spec propia. Tira de días, filtros y escritorio: spec propia.
- Supabase Pro y renombrar a `prod`: spec de la jornada publicada.

## Notas para el gate humano
- **H-1 Criterio de xornada actual (decidido, Alberto Fojo, 2026-10-07):** `currentRound` por competición (CA-5), ya probado en `calendario:xornada`, como recomendó el arquitecto. Efecto: hacia el miércoles por la tarde la pantalla pasa de resultados a la siguiente ronda. Se descartó la ventana fija viernes-lunes.
- **H-2 `live` de otra ronda (decidido, Alberto Fojo, 2026-10-07):** sí se muestran (un partido aplazado que se juega entre semana no puede faltar mientras está en xogo).
- **H-3 Publicar al mergear (decidido, Alberto Fojo, 2026-10-07):** sí: `/` muestra datos reales en producción ya en Free (sin Realtime la carga la acota la caché), con `noindex` hasta la spec de jornada publicada.
- **N-1 Orden de despliegue.** Nada en `src/` ni `tools/` usa la clave `anon` ni PostgREST hoy (grep: solo tests), así que retirar `public_read` no rompe `main`. Antes del merge: `npm run db:push` (CA-2), `npm run db:web-reader`, variable en Vercel (CA-3). Si falta la variable, `/` dice «no dispoñible», no se rompe.
- **N-2** `season` en la vista no está en la lista de §3: no es sensible (el canal `board:<season>` ya la publica) y evita leer temporadas pasadas.
- **N-3 Precisión de ADR-014 §6.** «ETag por máxima `version`» no detecta cambios: `version` es por partido, y una Decision nueva en un partido con menos versiones no mueve el máximo. La spec usa el hash del cuerpo; la decisión (ETag y caché) no cambia. Aceptado por el titular (Alberto Fojo, 2026-10-07) como precisión en esta spec, sin ADR nuevo.
- **N-4** CI no ejecuta `test:db` ni `e2e:db` (no hay base en CI, como hoy): los corre el verificador en local.
