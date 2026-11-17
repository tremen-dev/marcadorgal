# Carrusel «Resumo da xornada»

`carrusel.mjs` lee la página pública de marcador.gal (portada o archivo
`/xornada/AAAA-MM-DD`) y pinta un carrusel 4:5 (1080×1350 PNG) con la
identidad de SPEC-064 (`tools/social-render.mjs`, `src/design/tokens.ts`).

- **Portada**: «Resumo da xornada», fechas, nº de equipos gallegos y
  competiciones.
- **Una diapositiva por competición**, solo partidos con equipo gallego
  (nombre en celeste, el que pierde atenuado). Más de 6 partidos → se parte en
  dos; las competiciones pequeñas comparten diapositiva (≤ 5 partidos).
  Aplazado, suspendido o pendiente: con palabras, no solo color.
- **Cierre**: «Todo o fútbol galego nunha pantalla · Ligazón na bio».
- Deja también `datos.json` con lo leído.

## Uso (desde la raíz del repo)

```
node media/instagram/carrusel/carrusel.mjs <carpeta-salida> [url] [--goleadores]
```

- Sin `url`: la xornada actual (`https://marcador.gal/`), para el domingo por
  la noche. Partidos del lunes salen con fecha y hora.
- Archivo: `https://marcador.gal/xornada/2026-11-14` (redirige al primer día
  de la xornada).
- `--goleadores`: añade los goleadores de los equipos gallegos. Desactivado por
  defecto porque la cobertura es irregular (2026-11-07: 1 de 18 partidos con
  goles; tablero del 11-11: 7 de 19).

`2026-11-07/`: tirada de prueba con la xornada del 6–8 de novembro.

Node 22 importa `tokens.ts` directamente (avisa de `MODULE_TYPELESS_PACKAGE_JSON`;
es inocuo).
