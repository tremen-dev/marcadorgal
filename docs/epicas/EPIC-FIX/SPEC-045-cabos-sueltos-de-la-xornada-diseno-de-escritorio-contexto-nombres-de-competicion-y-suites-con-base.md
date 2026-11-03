---
id: SPEC-045
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-02, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-03, por: sdd-implementador}
---
# SPEC-045 — Cabos sueltos de la xornada: diseño de escritorio, contexto, nombres de competición y suites con base

## Problema
SPEC-040 y SPEC-041 están `hecho` y en producción, pero dejaron cuatro cabos:
1. **D-8 contradice producción.** `docs/diseno/Escritorio.tpl.html` dibuja el lateral «Competicións» de 236 px, una sola lista ancha, la fila de margen de una línea y el panel de detalle. El lateral se retiró (ADR-022 Anexo A, SPEC-040 CA-4 y N-4). Si alguien sigue D-8 al pie de la letra, vuelve a meter lo retirado.
2. **`docs/fundacion/contexto.md`**, de lectura obligatoria (CLAUDE.md), sigue diciendo que «el lateral lleva a su competición» (SPEC-028) y no nombra SPEC-040, SPEC-041 ni SPEC-042.
3. **V-3 de SPEC-040.** En la columna de 360 px, «PRIMEIRA FEDERACIÓN · GRUPO / 1» deja el número solo en otra línea (`_qa/SPEC-040/verif-es-1920.png`, `verif-es-1024.png`).
4. **Suites con base sin correr.** `test:db` completo y `e2e:db` (Realtime y `xornada-gol-reciente.db.spec.ts` incluidos) no se han ejecutado nunca contra Supabase local: SPEC-040 V-1/F-SPEC-040-1 y SPEC-041 V-5/F-SPEC-041-1. La migración `20261101120000_spec041_scored_at.sql` está en producción y solo se probó en un postgres:17 con stubs.

**Plazo:** antes de la jornada del 2026-11-07/08 (SPEC-039).

## Usuarios / roles afectados
- Público de escritorio, gl y es (CA-3). Agentes y titular, que leen `contexto.md` y `docs/diseno/`. Implementador y verificador, que lanzan las suites.

## Criterios de aceptación
- **CA-1 Contexto al día.** En la lista de EPIC-003 de `contexto.md` hay una línea por SPEC-040 (fecha y hora por fila, una competición por columna de 360 px, **lateral retirado en escritorio**, ADR-022 Anexo A), por SPEC-041 y por SPEC-042. Las líneas de SPEC-028 (lateral) y SPEC-033 (cabecera por día) llevan anotado qué las sustituye. Se actualiza la «Última actualización». Evidencia: `grep -n "SPEC-040\|SPEC-041\|SPEC-042\|lateral" docs/fundacion/contexto.md` en el ledger.
- **CA-2 Diseño = escritorio implementado (H-2, H-3).** El artboard `Escritorio.tpl.html` (1440×900) deja de pintar el lateral (`{{ nav }}`, `t.mine`, 236 px), el panel de detalle (372 px, `{{ sel.` y `detailStyle`) y la ★ (columna de fila y píldora `fFav`); a 1440 caben 3 columnas. La zona principal es la rejilla de SPEC-040 CA-4: columnas de 360 px, hueco y relleno de 16 px, alineada a la izquierda, `align-items: start`. Cada columna tiene su cabecera (nombre, xornada, contador en palabras «N en xogo» o «N partidos», flecha) y sus filas con el margen de dos líneas de SPEC-040 CA-2 (72 px; línea 2 en mono 500 10 px/1.2). La regla de CA-3 se dibuja también aquí. `Movil.tpl.html` lleva el mismo margen de dos líneas en sus filas (H-3). Los `.dc.html` se regeneran con `node build.mjs` desde `docs/diseno/`. `HERENCIA.md` anota con fecha qué artboards cambian, y que `sistema-de-deseno-marcador-gal.html` sigue siendo la foto del 2026-09-12. Test en `src/design/` sobre `Escritorio.dc.html`: no hay lateral, panel de detalle ni ★, la rejilla tiene esos valores; sobre `Movil.dc.html`: la fila lleva el margen de 72 px con la línea 2 en mono 500 10 px/1.2; y los tpl + `_logic.js` reproducen byte a byte los `.dc.html` del repo. `tokens.test.ts` sigue verde (lee `Movil.dc.html`). Si el artboard se puede renderizar, se guarda una captura en `_qa/SPEC-045/`. Si no (el repo no trae `support.js`), se anota.
- **CA-3 Nombre largo de competición (H-1).** El nombre solo se parte antes de « · ». El último segmento («· Grupo 1») es indivisible, el nombre ocupa como mucho dos líneas y su `textContent` es el canónico, sin cambios (D-2). Ninguna elipsis, sin `scrollWidth > clientWidth`, sin scroll horizontal. E2e en `xornada-columnas.spec.ts` sobre `/demo/xornada` y `/es/demo/xornada`, a 360, 390, 1024, 1280, 1440, 1536, 1920 y 2200 px, con las cinco competiciones. El segmento final da `getClientRects().length === 1`, el alto del nombre es ≤ 2 × su `line-height` + 1 px y `textContent` es igual al nombre de la demo. Capturas a 1024 y 1920 en `_qa/SPEC-045/`.
- **CA-4 `test:db` completo en local.** Con `supabase start` (versión de la CLI anotada), `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db` → exit 0. Corren todos los `*.db.test.ts` (hoy 21), sin `skip` ni filtro, incluidos los casos SPEC-041 de `src/db/web.db.test.ts` y `src/db/realtime.db.test.ts`. El ledger guarda el comando, la cola de la salida (`Test Files`/`Tests`) y `supabase status -o env` con las claves redactadas (`API_URL` loopback).
- **CA-5 `e2e:db` completo en local.** Con la misma base, `npm run e2e:db` → exit 0 con los cinco `e2e/*.db.spec.ts`, incluidos `xornada-realtime.db.spec.ts` y `xornada-gol-reciente.db.spec.ts`. Solo se admite el `skip` de captura sin `QA_CAPTURE_DIR`, que ya existía. El ledger guarda passed/skipped por fichero.
- **CA-6 Lo que falle se arregla aquí.** Un fallo de CA-4 o CA-5 causado por SPEC-040, 041 o 042 se arregla con su test en rojo antes y en verde después, anotado como F-SPEC-045-n. Si hace falta una migración nueva, tocar una ya aplicada o salir de los ficheros de CA-8, se PARA y se vuelve al gate. Un fallo de entorno (Windows/CRLF, F-SPEC-040-2) se repite en Linux con un export LF y se anota.
- **CA-7 Destinos de follow-ups.** En «Salvedades / follow-ups» de los ledgers de SPEC-040 y SPEC-041 se añade una línea fechada que reasigna: V-1/F-SPEC-040-1, V-3 y V-5/F-SPEC-041-1 → SPEC-045, y F-SPEC-040-2 → EPIC-MANT (EPIC-MEJORA no existe en `docs/epicas/`). No se tocan los veredictos ni los frontmatters. Evidencia: `git diff` de los dos ledgers, solo con esas líneas.
- **CA-8 Gates y nada de más.** `npm run gates` → 0 y `CI=1 npm run e2e` en verde, en `mcr.microsoft.com/playwright:v1.63.0-noble` sobre `git -c core.autocrlf=false archive HEAD`. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/model src/app/api supabase` vacío. Solo se tocan `docs/diseno/`, `contexto.md`, `src/components/xornada/` (nombre de competición), los tests, los e2e y los ledgers de SPEC-040/041/045. Sin hex ni `font:` bajo `src/`, i18n con paridad y sin dependencias nuevas.

## Entidades y reglas afectadas
Xornada, competición (`dominio.md`); D-2, D-8; ADR-005 (exc. 4), ADR-022 Anexo A,
ADR-014 §1 (remoto = producción). SPEC-040 CA-2/CA-4/CA-6/CA-7, SPEC-041
CA-1/CA-6/CA-7, SPEC-022 (guardas de `test:db`/`e2e:db`), SPEC-028, SPEC-033.

## Fuera de alcance
Goleadores. `.gitattributes`/CRLF (F-SPEC-040-2 → EPIC-MANT). La revisión de diseño del gol reciente y dibujarlo en `docs/diseno/` (SPEC-041 N-2, V-4). En es, «Finalizado» casi pegado al equipo (2.ª mitad de V-3). Las barras superior y de días del artboard (pestañas, búsqueda, título de SPEC-028, frescura, leyenda). El export monolítico. Los comentarios `// QA_CAPTURE_DIR=…/_qa/SPEC-0NN` de cinco e2e, incluido `xornada-gol-reciente.spec.ts:27`: son convención de la casa y la carpeta existe. «EPIC-MEJORA» en otros ledgers (SPEC-022 F-1) y en la plantilla del plugin. Cualquier base remota.

## Notas para el gate humano
- **Resolución del titular (Alberto Fojo, 2026-11-03):** H-1 = (a): el nombre solo se corta antes de « · » y «· Grupo N» no se parte (CA-3); elipsis + `title` rechazada por D-2. H-2 = (a): fuera del artboard también el panel de detalle de 372 px (ADR-005 exc. 4) y la ★; 3 columnas a 1440 (CA-2). H-3 = sí: `Movil.tpl.html` gana el margen de dos líneas (CA-2). N-2: la Supabase local se puede usar y resetear cuando toque; ninguna otra sesión depende de ella.
- **N-1 ¿EPIC-FIX?** El criterio 2 de la épica pide daño demostrado. Aquí está en los puntos 1, 3 y 4 del problema. El titular lo pide en EPIC-FIX (2026-11-02), con precedente en SPEC-022.
- **N-2 Base local.** `e2e:db` siembra y su teardown hace `supabase db reset --local`; el titular lo autoriza (2026-11-03). Las guardas de SPEC-022 impiden tocar producción.
