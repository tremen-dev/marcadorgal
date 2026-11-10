---
id: SPEC-072
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-10, por: sdd-verificador}
---
# SPEC-072 — Navegación entre semanas de la xornada

## Problema
Titular (2026-11-10): «desde que quitamos la tira de días, no podemos viajar a otra jornada desde la web». Causa: las flechas ‹ › de SPEC-027 CA-6 solo existen **dentro** de `DayStrip` (`XornadaControls.tsx`, `data-testid="week-strip"`), y SPEC-061 CA-3 monta `DayStrip` solo si `showDayStrip`, que vale `false` en producción. Al ocultar los días se ocultaron también las flechas, en `/`, `/es` y `/xornada/[fecha]`; `weekArrows` se sigue calculando (`week-read.ts`, `week-route.ts`) y nadie lo pinta. No lo vio ningún test: `playwright.config.ts` y `playwright.db.config.ts` arrancan con `SHOW_DAY_STRIP: "true"`, y el e2e de flechas (`e2e/xornada-weeks.db.spec.ts`) corre con la tira visible. Evidencia de campo (2026-11-10, `curl` + `grep data-testid`): `https://marcador.gal/`, `/es` y `/xornada/2026-10-31` (200) sirven `xornada-title` y ningún `week-previous`/`week-next`; `/xornada/2026-11-07` responde 307 a `/` (hoy es la semana de la portada, SPEC-027 H-3). Regresión de SPEC-027 CA-6 que ya hace daño → EPIC-FIX.

## Usuarios / roles afectados
Público (gl y es, móvil y escritorio, con y sin JS): vuelve a los resultados de semanas pasadas y ve las siguientes.

## Criterios de aceptación
Destinos, rutas, caché y semántica de semana **sin cambios** (SPEC-027 CA-1..CA-5). Solo cambia dónde se pintan las flechas. Posición decidida en H-1 = A: ‹ y › a ambos lados del texto del `<h1>` de SPEC-028 CA-6 («‹ Xornada · 30 out – 2 nov ›»), dentro de su fila (móvil: la fila de 42 px del título; escritorio: la barra superior), con el glifo y el estilo de `.weekArrow` (sans 400, `--fg-dim`, 26 px). Las flechas son hermanas del texto y no forman parte del nombre accesible del `<h1>`.
- **CA-1 Flechas independientes de la tira.** Dado `showDayStrip` falso (defecto) y `arrows` definido, cuando se sirve `/`, `/es` o `/xornada/<semana>` con filas, entonces el HTML contiene `week-previous` (o `week-previous-gap`) y `week-next` (o `week-next-gap`) exactamente una vez cada uno, y ningún `day-strip`. Con `showDayStrip` verdadero, las flechas siguen apareciendo una sola vez (no duplicadas). Sin `arrows` (demos) no hay flechas. Test de componente sobre `XornadaBody` con las cuatro combinaciones.
- **CA-2 Contrato de enlace (SPEC-027 CA-6, sin cambios).** Cada flecha es `<a href>` al destino de `weekArrows`, sin fragmento, con `aria-label` `xornada.previous` / `xornada.next` (claves i18n existentes; gl «Xornada anterior» / «Xornada seguinte», es «Jornada anterior» / «Jornada siguiente») y glifo `aria-hidden`; sin destino, hueco del mismo ancho `aria-hidden` y fuera del tabulado. Objetivo táctil ≥ 24 px (ADR-005 exc. 6), colores solo por tokens de `src/design/tokens.ts`, contorno de foco visible, sin `font:` shorthand. Test de componente: `href`, `aria-label` en gl y es, hueco sin `tabindex` alcanzable.
- **CA-3 Sin espacio vertical nuevo (motivo de SPEC-061).** Las flechas están en la misma fila que el texto del título (`boundingBox` de ‹, del texto y de › con el mismo centro vertical ± 2 px, ‹ a la izquierda del texto y › a su derecha) y no en otra banda; el nombre accesible del `<h1>` no contiene «‹» ni «›». La altura de la cabecera + controles en móvil (360 y 390 px) es igual a la de `main` antes del cambio (± 0 px) y el título no se trunca ni provoca scroll horizontal (D-2). Playwright mide `boundingBox` de `main` antes/después.
- **CA-4 e2e con la configuración de producción.** Un e2e nuevo corre contra un servidor **sin** `SHOW_DAY_STRIP` (el `boxPort` de SPEC-061 CA-5 o equivalente con base): sin JS, desde `/` el ‹ lleva a `/xornada/<semana anterior>`, cuyo título es el de esa semana, y su › vuelve a `/`; lo mismo en `/es` → `/es/xornada/…` → `/es`; en la primera semana de la temporada no hay enlace ‹. Los e2e existentes de SPEC-027 y SPEC-061 siguen en verde.
- **CA-5 Teclado.** Desde la carga de `/`, con Tab se alcanza ‹ antes que › y antes que los filtros; Enter navega. Playwright en gl y es.
- **CA-6 Verificación visual local (sin Docker).** Contra `next start` local con la base pública (o Chrome sobre el despliegue de preview), capturas en `_qa/SPEC-072/` de `/`, `/es`, `/xornada/<semana pasada>` y `/es/xornada/<semana pasada>` a 390 px y 1440 px: flechas visibles a ambos lados del título, foco visible en una, sin scroll horizontal ni título truncado. Recorrido real anotado en el ledger: desde `/` se pulsa ‹ hasta `/xornada/2026-10-31` (o la semana pasada que toque según la fecha; `2026-11-07` es la semana de la portada hasta que `currentRound` avance, y entonces el recorrido llega a `/xornada/2026-11-07`) y con › se vuelve a `/`. Ningún estado del enlace se comunica solo por color.
- **CA-8 Diseño al día (D-8).** El implementador refleja la nueva posición en `docs/diseno/`: en `Movil.tpl.html` y `Escritorio.tpl.html` las ‹ › pasan a flanquear el título (la tira sigue dibujada como opcional, SPEC-061), regenera los `.dc.html` con `node build.mjs` y añade a `HERENCIA.md` una entrada «2026-11-10 (SPEC-072 CA-8, H-1 = A)». `git diff --stat` de la rama incluye esos ficheros.
- **CA-7 Gates y frontera.** `npm run gates` y `npm run e2e` en verde; sin dependencias nuevas. `git diff origin/main --stat -- src/board src/sources src/decide src/ingest supabase src/app/api src/app/config.ts` vacío.

## Entidades y reglas afectadas
Xornada, semana como clave de navegación (`dominio.md`). D-2, D-8. ADR-005 (exc. 6). SPEC-027 CA-2/CA-6, SPEC-028 CA-6 (título), SPEC-061 CA-3/CA-5.

## Fuera de alcance
Volver a mostrar la tira de días; cambiar destinos o semántica de semana; selector de fecha o de ronda; temporadas pasadas.

## Notas para el gate humano
- **H-1 Dónde van las flechas: decidido A.** Contexto: `docs/diseno/` (`Movil.tpl.html` l. 40-47, `Escritorio.tpl.html` l. 47-52) solo dibuja ‹ › dentro de la tira de días; sin tira no hay sitio dibujado. Opciones: **(A, recomendada)** ‹ y › a ambos lados del texto del `<h1>` («‹ Xornada · 30 out – 2 nov ›»), con el glifo y color del diseño (sans 400 14/15 px, `--fg-dim` como `.weekArrow` hoy, 26 px de ancho): en móvil va en la fila de 42 px que el título ya ocupa, cero altura extra; (B) una banda de 40 px solo con ‹ ›: devuelve el alto que SPEC-061 quitó; (C) reactivar la tira por defecto: deshace la decisión del 2026-11-08. Si el titular quiere otra forma, se dibuja primero en `docs/diseno/` (D-8) y se anota en `HERENCIA.md`.
- **H-2 EPIC-FIX y no EPIC-003: confirmado.** Es la regresión de un CA ya cerrado (SPEC-027 CA-6) introducida por SPEC-061, con daño en producción comprobado; cambio mínimo, sin capacidad nueva.
- **Decidido por el titular (Alberto Fojo, 2026-11-10):** H-1 = A (flechas a ambos lados del texto del `<h1>`, sin altura extra en móvil); H-2 = EPIC-FIX.
- **N-1** El hueco de cobertura (e2e siempre con tira) se cierra con CA-4; no se toca la configuración de Playwright de los demás tests.
