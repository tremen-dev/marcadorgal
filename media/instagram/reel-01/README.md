# Reel 01 — «Comezamos!» (demo de una xornada)

`reel-marcadorgal.mp4`: 1080×1920, 30 fps, 20 s, H.264, sin audio (la música
se pone en Instagram desde su biblioteca). Publicado el 2026-11-11.

Guion: Primeira en pantalla → el Deportivo empata 2-2 en el 78' (pastilla
«GOL» que late) → toque en la fila: «78' Miguel Loureiro» con su marca «GOL»
→ bajada a Segunda (toque en Sporting, Dubasin) → bajada a Terceira → fundido
a `assets/redes/ig-story.png`. Rótulos: «Todo o fútbol galego nunha pantalla»,
«GOL! ⚽ ao momento», «E quen os marca», «De Primeira…», «…a Terceira RFEF»,
«En directo e en galego». Chip fijo «Exemplo · datos de mostra».

Los datos son los de `/demo/xornada` (inventados). El paso del Betis–Deportivo
a directo y el gol de Loureiro se inyectan en el DOM desde `record.mjs`; la
demo del repo no cambia.

## Regenerar

1. Servidor de desarrollo **sin** `VERCEL_ENV=production` (el `.env.local`
   lo trae y la demo da 404):
   `VERCEL_ENV=development npm run dev -- --port 3011`
2. Fotogramas (desde la raíz del repo, `<out>` = carpeta temporal):
   `node media/instagram/reel-01/record.mjs <out>`
3. Montaje con cierre:
   ```
   ffmpeg -framerate 30 -i <out>/frames/f%05d.jpg -loop 1 -framerate 30 -t 2.8 -i assets/redes/ig-story.png \
     -filter_complex "[0:v]format=yuv420p,setsar=1[a];[1:v]scale=1080:1920,format=yuv420p,setsar=1[b];[a][b]xfade=transition=fade:duration=0.4:offset=17.2,format=yuv420p" \
     -c:v libx264 -crf 18 -preset medium -r 30 -movflags +faststart reel.mp4
   ```

## Cómo graba (y por qué así)

Determinista, fotograma a fotograma: una línea de tiempo de eventos y, en cada
fotograma, todas las animaciones CSS en pausa y situadas en su instante
(`document.getAnimations()`), el scroll puesto a mano y una captura de 1080×1920.
Lo que **no** funcionó:

- Screencast de CDP y `Page.captureScreenshot` sin clip: salen a 360×640 (CSS px).
- `captureScreenshot` con `clip.scale: 3`: el clip va referido al documento;
  tras hacer scroll, sale negro.
- Captura en bucle concurrente con esperas reales: satura el navegador y estira
  los tiempos (vídeos de 200–450 s).
- Bloquear el WebSocket de HMR: Next en desarrollo **no hidrata** y los toques
  no despliegan nada. Solución: dejar conectar, esperar a la hidratación y
  después descartar los mensajes del servidor (otra sesión editando el repo
  provocaba recargas a mitad de grabación).
