---
id: ADR-028
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-028: Celeste de Galicia como color de marca y barra sola como icono (enmienda ADR-005)

- Deciders: sdd-arquitecto propone (2026-11-08) a encargo del orquestador. **Alberto Fojo (titular)** decidió color, wordmark e icono el 2026-11-08 tras tres rondas de comparativas visuales: paletas (claude.ai/artifact/JiRuHoMxn1oihhHDPgViFu), portada real en celeste (claude.ai/artifact/FtCYj6V5BtYp6Uta7pASDf) e icono de barra sola (claude.ai/artifact/7TiqSyKk3TTHZGG51hqtjH). Asume los riesgos de asociación con el Celta y con la comunicación institucional.
- Specs relacionadas: SPEC-063 (tokens, `--victoria`, wordmark, icono y `docs/diseno/`), SPEC-064 (assets de redes y `og.png`). Enmienda ADR-005 y sustituye la elección de icono de SPEC-033 H-6 (semente B).

## Contexto
ADR-005 fija el verde `#56DB8F` como color de marca y declara `docs/diseno/` no editable. El titular quiere que la marca haga un guiño a Galicia, que es su motivación principal, y el verde se confundía con el de WhatsApp, el canal principal de difusión. La semente B (dos barras hueso + verde, SPEC-033) se lee mal a 16 px junto al nuevo color. `Marca.dc.html` pedía no fijar logotipo antes de comprobar la OEPM.

## Decisión
1. **Color de marca = celeste de la bandera de Galicia.** `--marca #0099CC` (5.78:1 sobre `--bg`), `--marca-deep #3A93BA` (5.45:1), `--marca-ink #00151F` (5.70:1 sobre `--marca`). Todo relleno de marca lleva texto en `--marca-ink`, nunca hueso (`#F5F1EA` sobre `#0099CC` = 2.90:1). Sustituye la cláusula «verde `#56DB8F` solo marca» de ADR-005. **Se mantiene la regla:** la marca nunca es estado (`live` = ember, espera = ámbar, alerta = rojo) y ningún estado se comunica solo con color.
2. **Verde = victoria, token semántico de resultado (decisión del titular, 2026-11-08).** `COLORS.victory` `#4CC38A` (`--victoria`; 8.53:1 sobre `--bg`, texto `--bg` sobre él) para la V de la racha. No es marca ni estado de partido: ningún componente de marca (wordmark, icono, assets) lo usa, y no reutiliza el antiguo `#56DB8F`, que queda retirado del todo. La spec de la racha añadirá gris = empate y granate = derrota.
3. **Wordmark.** Sigue siendo «marcador▮gal» (Geist 800, tracking −0.045em, minúscula), pero el ▮ deja de ser un glifo: es un bloque redondeado dibujado y decorativo (`aria-hidden`) con la proporción de la barra del icono (8 × 19, radio 2.5 en la retícula de 48 ≈ ancho .3em, alto .72em, radio .095em). El nombre accesible del enlace no cambia.
4. **Icono = una sola barra celeste.** La barra 8 × 19 rx 2.5 escalada × 1.35 y centrada en (24, 24) de la retícula de 48, sobre el tile actual (`--bg`, rx 11, hairline `--line`). Variante para redes: fondo `--marca` y barra en `--bg`. Las tres sementes de `Marca.dc.html` quedan como historia.
5. **`docs/diseno/` se edita en lo de marca** (excepción a ADR-005 «no se edita»): `_tokens.css` (incluido `--victoria`), `Marca.dc.html`, las plantillas `*.tpl.html` (y sus `.dc.html` con `build.mjs`) y los `.dc.html` sin plantilla cambian los tres hex de marca; cada cambio se anota en `HERENCIA.md`. `sistema-de-deseno-marcador-gal.html` sigue siendo la foto del 2026-09-12.
6. El resto de ADR-005 (semántica de estados, excepciones 1–6, dígitos tabulares, solo modo oscuro) sigue en vigor. Al aprobar este ADR se añade a ADR-005 una nota «cláusula del verde enmendada por ADR-028», sin tocar su decisión.

## Consecuencias
### Positivas
Un cambio de tres valores en `COLORS` repinta todo lo que usa tokens. La marca deja de competir con el verde de WhatsApp en la captura compartida. Un solo bloque une wordmark e icono.
### Negativas / follow-ups
- **OEPM pendiente (no bloqueante).** Se adopta la identidad sin la comprobación que pedía `Marca.dc.html`. Acción del titular: buscar en la OEPM «marcador.gal» y variantes antes de invertir en difusión pagada. La protección recae sobre todo en el wordmark; una barra redondeada protege poco como marca figurativa.
- Celeste asociable al Celta y a lo institucional (riesgo asumido).
- Se abre una familia de colores de resultado (§2). Hoy solo existe `--victoria`; `.formD` (ámbar, choca con la semántica de espera) y `.formL` quedan para la spec de la racha, que fijará gris y granate con contraste ≥ 4.5.
- `docs/paginas/*.html` (no servidas) conservan el verde hasta que alguien las mantenga a mano.

## Alternativas consideradas
- **Verde menos eléctrico `#5FBF8C`**: sigue sin guiño a Galicia y cerca del verde de WhatsApp.
- **Azul aclarado `#7AA2F7`**: lee a «tecnológico», no a bandera.
- **Azul marino `#2F5DA8`**: 2.93:1 sobre `--bg`, no cumple WCAG AA para texto.
- **Victoria en `#56DB8F`**: reutilizar el verde retirado mezclaría marca vieja y resultado y debilitaría la prohibición del hex viejo.
- **Mantener la semente B en celeste**: dos barras de dos colores pierden lectura a 16 px y el hueso compite con la barra de marca.
