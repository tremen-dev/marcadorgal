---
id: ADR-035
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-035: Caveat autoalojada como tercera familia solo para el lema (enmienda ADR-005)

- Deciders: sdd-arquitecto propone (2026-11-10) a encargo del orquestador. **Alberto Fojo (titular)** decidió el lema «todo o fútbol galego», la tipografía Caveat, su autoalojamiento, el color (`--fg` al 72 %) y los tamaños (19 px escritorio, 16 px móvil). Este ADR solo registra el encaje en el sistema de diseño; pendiente de su aprobación.
- Specs relacionadas: SPEC-081 (lema junto al logo). Enmienda ADR-005 («Geist autoalojada»; `docs/diseno/` no se edita) y ADR-001 («Geist y Geist Mono autoalojadas»), igual que ADR-029 hizo con la marca.

## Contexto
ADR-005 y ADR-001 fijan dos familias, Geist y Geist Mono, autoalojadas. `tokens.ts` las transcribe en `FAMILIES` y `FACES`; `parity.test.ts` exige paridad de `FAMILIES` con `docs/diseno/_tokens.css` y `fonts.test.ts` exige que cada `@font-face` de `globals.css` esté en `FACES`. Una tercera familia es, por tanto, un cambio del sistema de diseño (D-8), no un detalle de un componente.

## Decisión
1. **Caveat 400 es la tercera familia del sistema**, token `FAMILIES.hand` → `--hand: 'Caveat', <pila de Geist>` (la pila de reserva es la de `--sans`, no el genérico `cursive`, que en Windows es Comic Sans).
2. **Uso único: el lema de marca** junto al wordmark. Ningún otro texto (datos, estados, títulos, números) usa `--hand`. Un segundo uso exige ADR.
3. **Autoalojada como Geist**: un `.woff2` en `public/fonts/` (peso 400, subconjunto latino que incluya «ú»), su `@font-face` en `globals.css` con `font-display: swap`, entrada en `FACES` y licencia OFL junto al fichero. Nada se pide a `fonts.googleapis.com`/`gstatic.com` en runtime. Sin `preload`: el lema no compite con la primera pintura (SPEC-026).
4. **`docs/diseno/` se edita** en lo mínimo (excepción a ADR-005, como ADR-029 §5): `_tokens.css` gana `--hand` (y Caveat en su `@import` de referencia), las cabeceras de `Movil.tpl.html` y `Escritorio.tpl.html` dibujan el lema (y sus `.dc.html` con `node build.mjs`), y `HERENCIA.md` anota el cambio. `sistema-de-deseno-marcador-gal.html` sigue siendo la foto del 2026-09-12.
5. **Color del lema: `var(--fg)` con opacidad 0.72**, sin token de color nuevo (un solo uso; un token exigiría paridad y otro cambio en `_tokens.css`). Contraste resultante ≈ 8.9:1 sobre `--bg`.
6. Al aprobar, ADR-005 y ADR-001 reciben una nota «familias ampliadas por ADR-035», sin tocar su decisión.

## Consecuencias
### Positivas
El lema entra por la puerta del sistema: tests de paridad y de fuentes lo cubren, y el uso único queda escrito.
### Negativas / follow-ups
Unos KB más de fuente (no críticos). `FACES` pasa de 6 a 7 y `fonts.test.ts` cambia su expectativa. Los PNG de marca (`og.png`, assets de redes, SPEC-064) no llevan lema: si se quiere, otra spec.

## Alternativas consideradas
- **Cargar Caveat desde Google Fonts**: rechazada por el titular (autoalojada) y por la regla de no pedir a dominios ajenos.
- **Lema en SVG/imagen**: sin i18n, sin selección de texto, peor accesibilidad; rechazada.
- **Token de color `--fg-lema`**: un solo uso; no compensa tocar `COLORS` y `_tokens.css`. `--fg-muted` (#A7A5A0) se descarta por no ser la referencia aprobada.
- **`font-display: optional` + `preload`**: en 3G mostraría la reserva en la primera visita y el preload compite con el HTML/CSS críticos; rechazada.
