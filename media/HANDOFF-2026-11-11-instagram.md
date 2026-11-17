# Handoff — apertura de Instagram (2026-11-11)

Sesión de comunicación, fuera de tremen-sdd: ninguna spec cambia de estado.

## Hecho

- **Decisión:** abrir Instagram como escaparate de bajo mantenimiento, no como
  segundo canal en directo (eso es X vía Buffer, EPIC-007). Línea editorial:
  altavoz de toda Galicia, sin destacar equipos (ver `instagram/perfil.md`).
- **Cuenta @marcador.gal creada y configurada** por el titular con
  `instagram/perfil.md`. Foto de perfil desde `assets/redes/` (SPEC-064, ya
  existía).
- **Publicado:** post de presentación y **reel 01** (`instagram/reel-01/`), con
  los copys de `instagram/copys.md`.
- **Carrusel «Resumo da xornada»** listo y probado con datos reales
  (`instagram/carrusel/`, tirada `2026-11-07/`). Aún no publicado.
- `biome.json`: añadido `!media` para que estos scripts no entren en el lint
  (mismo trato que `tools/`).

## Pendiente

1. **Domingo 2026-11-15 por la noche:** generar el carrusel de la xornada y
   publicarlo con la plantilla de `copys.md`. Decidir si se espera al lunes
   (partidos del lunes) y si hay cobertura para `--goleadores`.
2. **Difusión orgánica** (en curso, el titular con amigos): primera hora de
   cada pieza (verla, comentar con frases, guardar, compartir en story),
   reenvío del mensaje de WhatsApp de `copys.md`, colaboraciones con cuentas
   gallegas, stories de resultados mencionando a todos los clubes de un bloque.
3. **Medir** visitas desde Instagram (`?ig` en el enlace de la bio, logs de
   Vercel). Si se quiere en serio → `/sdd-orquestador` (EPIC-009).
4. **Si el carrusel se vuelve semanal:** épica nueva («Instagram: resumen de
   jornada automatizado») → spec → mover `carrusel.mjs` a `tools/` con tests y
   publicarlo por Buffer. Añadir columna «Instagram» a la tabla de piezas de
   EPIC-008 (patrocinio).
5. **Commit de `media/`** (≈ 6 MB, incluye el mp4 y los PNG): sin hacer; decidir
   si el vídeo va al repo o solo los scripts y los textos.

## A tener en cuenta

- `.env.local` trae `VERCEL_ENV="production"`: `/demo/xornada` da 404 en
  local salvo arrancando con `VERCEL_ENV=development`.
- El reel muestra un gol del Deportivo (pedido por el titular) aunque después se
  fijó la regla de «ningún equipo concreto»; el copy publicado no nombra
  equipos. Para futuros reels, repartir protagonismo o usar Terceira.
- Durante la sesión otra sesión editaba el repo (la versión pasó de 0.10.1 a
  0.10.4): el servidor de desarrollo recargaba la demo. El grabador ya lo evita.
- Los procesos `next dev` en segundo plano pueden sobrevivir a su tarea en
  Windows (puerto 3011 ocupado): matar por PID del puerto.
