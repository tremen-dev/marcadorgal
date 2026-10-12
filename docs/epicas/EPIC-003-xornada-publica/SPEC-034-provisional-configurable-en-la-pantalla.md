---
id: SPEC-034
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-10-12, por: sdd-arquitecto}
---
# SPEC-034 — `provisional` configurable en la pantalla

## Problema
El titular (2026-10-12): «en la mayoría de partidos aparece la leyenda
'provisional', ensucia mucho la página». Con una sola fuente no oficial casi
toda Decision sale `provisional` (`dominio.md`, Cualificador; `reglas.md`
RN-02) y la fila lo pinta como etiqueta ámbar (SPEC-019 CA-3). El titular
quiere poder elegir cómo se presenta, y cambiarlo sin rediseñar.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS. El operador no cambia.

## Criterios de aceptación
Solo presentación: el cualificador de la Decision, `PublicMatch` y Realtime no
cambian. Sin dependencias ni migración si H-1 = 1.
- **CA-1 Modos (puro).** `src/xornada/` exporta `ProvisionalDisplay = "label" | "mark" | "hidden"` y la fila trae cómo pintar su cualificador según el modo. Solo afecta a `provisional`: `confirmado` nunca se pinta y `sen_sinal` siempre lleva su etiqueta (D-9, EPIC-003 criterio 5). Test de tabla modo × cualificador × estado permitido.
- **CA-2 `label`.** Igual que hoy (SPEC-019 CA-3): etiqueta i18n `qualifier.provisional` en ámbar junto al margen.
- **CA-3 `mark` (H-2, H-3).** En el sitio de la etiqueta, el glifo `*` en ámbar (`aria-hidden`) y, para lectores de pantalla, el texto `qualifier.provisional` (`srOnly`). Al pie de la lista, una sola leyenda i18n `qualifier.provisionalLegend` (gl «* provisional: dato dunha soa fonte, aínda sen confirmar»; es «* provisional: dato de una sola fuente, aún sin confirmar»), letra `TYPE.eyebrow` sin mayúsculas, `--fg-muted`. Con JS, la leyenda se oculta si ninguna fila visible (día, filtro, plegado no cuenta) es `provisional`, y vuelve al cambiar. Sin JS, se ve si alguna fila servida lo es. El glifo no es color: el significado lo da glifo + leyenda.
- **CA-4 `hidden` (H-4).** Nada visible ni leído de `provisional` en la fila; `data-qualifier` sigue en el DOM para tests. Sin leyenda.
- **CA-5 Dónde se elige (H-1 = 1, recomendada).** Una constante tipada `PROVISIONAL_DISPLAY` en un único módulo de configuración de la web (fuera de `src/xornada/`, que es puro), que la página pasa a la pantalla y al cliente de SPEC-024. Valor inicial según H-2. Test: el valor es uno de los tres modos. Cambiarlo es una línea y un PR. Si H-1 elige otra opción, este CA se reescribe antes de aprobar.
- **CA-6 Render y e2e.** Test de render de `MatchRow` y de la leyenda en los tres modos (gl y es). Playwright en `/demo/xornada` y `/es/demo/xornada` con el modo por defecto, 390 y 1440 px, con y sin JS: glifo y leyenda presentes, leyenda oculta con «Rematados» si no queda `provisional`, `sen_sinal` con etiqueta. La demo tiene `provisional` en `live` y `finished`. Nada se trunca, textos solo de `src/i18n/` (paridad), colores por tokens, ningún `font:`.
- **CA-7 Gates.** `npm run gates`, `e2e`, `e2e:db` en verde. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío.

## Entidades y reglas afectadas
Cualificador (`dominio.md`), RN-02, RN-05. D-8, D-9. ADR-005 (ámbar =
provisional; nunca solo color; exc. 2). SPEC-019 CA-3, SPEC-024 (cliente).
Con `hidden` o `mark` por defecto: precisión en `dominio.md` (H-4).

## Fuera de alcance
Cambiar cuándo una Decision es `provisional` (motor, EPIC-002); configurar
`sen_sinal`; un panel para cambiar el modo (EPIC-004).

## Notas para el gate humano
- **H-1 Mecanismo.** ADR-001: Vercel Pro; Supabase pasa a Pro (ADR-014 §1). La página es ISR de 10 s (ADR-014 §6).

| # | Opción | Coste | Cambio efectivo | Encaje | ADR |
|---|---|---|---|---|---|
| 1 | **Constante en código** | 0 | PR + deploy (~5 min) | Total; versionado y testado | No |
| 2 | Variable de entorno | 0 | Editar en Vercel + redeploy (~3 min) | Bueno; fuera de git, deriva entre Preview y Prod | No |
| 3 | Fila en tabla `web.config` (Supabase), leída por `web_reader` | Migración + una lectura por render | SQL o dashboard; ≤ 40 s (ISR) | Amplía la superficie de ADR-014 §4 | Sí |
| 4 | Vercel Flags / Flags SDK | Dependencia + clave; cupo del plan | Dashboard, segundos | Evaluar por petición rompe ISR: exige `precompute` (variantes de ruta) | Sí |
| 5 | Global Config (ex Edge Config) | Dependencia + store; cupo de lecturas | Dashboard/API, segundos + ISR | Lectura en render ISR, ~1 por 10 s y región | Sí |

  Recomendada **1**: es una decisión editorial que cambiará pocas veces; queda en git, la cubren los tests y no añade superficie pública ni proveedor. Si se quiere cambiar sin deploy, **3** (infra que ya hay, sin proveedor nuevo), con ADR propio que sdd-arquitecto escribe tras la elección. 4 y 5 son para experimentos o despliegues graduales, que aquí no hay.
- **H-2 Modo por defecto.** Recomendado `mark`: limpia la fila y no esconde nada (glifo + leyenda + texto para lectores). `label` es lo de hoy; `hidden`, ver H-4.
- **H-3 Glifo `*`.** Recomendado: se entiende como «ver nota» sin aprender nada. Alternativas: `≈` o `?` (ADR-005 exc. 2 quitó `?` como etiqueta).
- **H-4 `hidden` contradice hoy `dominio.md`** («Siempre con etiqueta textual junto al color») y deja al público sin saber que el dato no está confirmado. Se ofrece porque se pidió; recomendado no usarlo por defecto. Si se aprueba `mark` o `hidden`, sdd-arquitecto precisa esa nota de `dominio.md` («en la pantalla pública, según el modo de SPEC-034») al aprobar.
