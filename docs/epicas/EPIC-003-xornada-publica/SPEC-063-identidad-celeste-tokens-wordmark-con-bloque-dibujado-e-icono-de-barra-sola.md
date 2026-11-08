---
id: SPEC-063
tipo: spec
epica: EPIC-003
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
---
# SPEC-063 — Identidad celeste: tokens, wordmark con bloque dibujado e icono de barra sola

## Problema
El titular cambia la identidad (ADR-028, 2026-11-08): la marca pasa del verde `#56DB8F` al celeste de Galicia, el ▮ del wordmark deja de ser un glifo y el icono pasa de la semente B (SPEC-033 CA-6) a una sola barra. Hoy el verde vive en `COLORS`, `tokens.css`, `docs/diseno/_tokens.css` (paridad) y los artboards; el ▮ es un carácter en `XornadaHeader` y `Footer`, y en la cabecera hereda por choque de nombres el `.mark` mono 12 px de `MatchRow` (`Xornada.module.css` tiene dos `.mark`). Los assets de redes y `og.png` van en SPEC-064.

## Usuarios / roles afectados
- Público, móvil y escritorio, gl y es, con y sin JS; quien instala la PWA.

## Criterios de aceptación
Sin migración, sin dependencias nuevas, sin lecturas nuevas.
- **CA-1 Tokens.** `COLORS.brand/brandDeep/brandInk` = `#0099CC`/`#3A93BA`/`#00151F`; `src/design/tokens.css` regenerado con `tools/tokens-css.mjs`; `docs/diseno/_tokens.css` con los mismos valores (`parity.test.ts` verde). Test nuevo de contraste WCAG con los valores de `COLORS`: `brand` y `brandDeep` ≥ 4.5 sobre `bg`, `bgElevated`, `bgStep`, `bgLive` y `bgSubtle`; `brandInk` ≥ 4.5 sobre `brand`. Token semántico nuevo `COLORS.victory = { value: "#4CC38A", css: "--victoria" }` (ADR-028 §2), también en `tokens.css` y `_tokens.css`: ≥ 4.5 sobre `bg` y `bgElevated` y con `bg` encima (8.53:1). Test: ninguna regla CSS bajo `src/` con `background: var(--marca)` declara `color: var(--fg)` (hueso sobre celeste = 2.90:1).
- **CA-2 Sin verde suelto.** `git grep -i -E "56DB8F|35C177|04160C" -- src tools public` vacío (lo comprueba un test de `src/design/`). Test: `var(--victoria)` solo aparece bajo `src/` en `StandingsTable.module.css`, y ni `Wordmark`, ni `icon.ts`, ni `social.ts`, ni `tools/` usan `COLORS.victory`. `manifest.ts` y `metadata.ts` siguen con `COLORS.bg` en `theme_color`/`background_color`/`themeColor` (tests actuales sin cambio).
- **CA-3 Wordmark con bloque dibujado.** Un componente `src/components/brand/Wordmark.tsx` lo pintan `XornadaHeader` y `Footer`: `marcador`, un `<span aria-hidden="true">` vacío y `gal`; ninguna fuente bajo `src/` ni `tools/` contiene `▮` (test). La clase del bloque no se llama `.mark`. Playwright en `/`, `/es`, `/demo/xornada` a 360 y 1440 px: el bloque mide ancho/`font-size` = 0.30 ± 0.02, alto/`font-size` = 0.72 ± 0.02, `border-radius` 0.095em ± 0.01, fondo `rgb(0, 153, 204)`; `textContent` de la página sin `▮`; el nombre accesible de `home-link` (`xornada.home`) y del enlace del footer (`common.title`) no cambia. Peso 800 y tracking `--tracking-display` donde ya los había.
- **CA-4 Icono de barra sola.** `iconSvg({ rounded, variant })` con `variant: "dark" | "brand"` (por defecto `dark`): tile como hoy y un único `rect` `x=18.6 y=11.175 width=10.8 height=25.65 rx=3.375`, en `COLORS.brand` (`dark`) o `COLORS.bg` sobre fondo `COLORS.brand` (`brand`). `node tools/icons.mjs` regenera los cinco ficheros de `ICON_FILES` con las medidas de hoy (variante `dark`). `icon.test.ts`: el SVG tiene un solo rect de barra; en `apple-touch-icon.png` el píxel central es `brand` y las esquinas `bg`; ningún píxel es `fg` (la barra hueso desaparece); `icon-32.png` mantiene las esquinas transparentes. Capturas 16/32/180/512 en `_qa/SPEC-063/`.
- **CA-5 `docs/diseno/` (ADR-028 §4).** `Marca.dc.html` presenta el wordmark con bloque dibujado y la barra sola como icono elegido (oscuro y variante celeste, a 72/32/16 px); las sementes A/B/C pasan a un bloque `data-historia` con su color original. Los tres `*.tpl.html` cambian los tres hex y `node build.mjs` regenera sus `.dc.html`; `Componentes.dc.html` y `Main.dc.html` cambian los tres hex a mano. Test: fuera de `sistema-de-deseno-marcador-gal.html` y de los bloques `data-historia`, ningún fichero de `docs/diseno/` contiene los tres hex viejos. `HERENCIA.md` gana la entrada del 2026-11-08.
- **CA-6 Pantalla.** Playwright en `/demo/xornada` y `/es/demo/xornada`, 360 y 1440 px: día seleccionado y competición activa con fondo `rgb(0,153,204)` y texto `rgb(0,21,31)`; nombre de equipo gallego `rgb(0,153,204)` y, perdedor, `rgb(58,147,186)`; el `live` sigue en ember. Capturas antes/después en `_qa/SPEC-063/`.
- **CA-7 Victoria en la racha.** `.formW` = fondo `var(--victoria)`, texto `var(--bg)`; la letra (V/W) se mantiene. Playwright en una clasificación con racha (demo o fixture e2e), 360 y 1440 px: celda V con fondo `rgb(76, 195, 138)` y texto `rgb(17, 17, 16)`; `.formD`/`.formL` sin cambio de color.
- **CA-8 Gates.** `npm run gates`, `e2e` y `e2e:db` en verde. `git diff origin/main --stat -- src/sources src/decide src/ingest src/board src/app/api supabase` vacío.

## Entidades y reglas afectadas
ADR-028 (todo; §2 token `--victoria`), ADR-005 (semántica de estados, sin cambio), D-8. SPEC-033 CA-5/CA-6 (marca de gallego e iconos: cambia el color y la semilla, no la regla), SPEC-051 (iconos PWA, mismas rutas), SPEC-028 (logo).

## Fuera de alcance
Assets de redes y `og.png` (SPEC-064). Resto de la racha: `.formD` (hoy ámbar), `.formL` y la leyenda «Postos de honra» (hoy `--marca`) van con la spec de la racha (gris = empate, granate = derrota). `docs/paginas/*.html` (no servidas). Marca de agua de la captura. Comprobación OEPM (ADR-028).

## Notas para el gate humano
- **H-1 `.formW` en verde de victoria (decisión del titular, 2026-11-08).** Valor elegido `#4CC38A` y no el antiguo `#56DB8F`: así la prohibición del verde viejo de CA-2 sigue siendo absoluta y el resultado no se confunde con la marca retirada ni con el verde de WhatsApp (`#25D366`). Texto `--bg` (8.53:1), sin token de tinta propio.
- **H-2 El ▮ de los artboards.** Recomendado: en `Escritorio/Movil/Global/Componentes/Main` cambian solo los hex; el glifo se queda, porque `Marca.dc.html` es la referencia del bloque. Alternativa: redibujarlo también (más diff en ficheros heredados).
- **H-3 Corrige de paso el choque de `.mark`**: la cabecera deja de usar el `.mark` de `MatchRow` al usar `Wordmark`; `MatchRow` no cambia.
