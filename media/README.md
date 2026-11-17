# media/

Piezas de comunicación de marcador.gal (redes sociales). **Fuera de tremen-sdd**:
no es código del producto, no lo cubre ninguna spec, no se despliega y Biome lo
ignora (`!media` en `biome.json`). Si algo de aquí pasa a ser recurrente o
automático, entra por `/sdd-orquestador` y se muda a `tools/` con su spec.

| Ruta | Qué es |
|---|---|
| `HANDOFF-2026-11-11-instagram.md` | Handoff de la sesión que abrió Instagram |
| `instagram/perfil.md` | Configuración de la cuenta @marcador.gal |
| `instagram/copys.md` | Textos publicados y plantillas |
| `instagram/reel-01/` | Primer reel (demo de una xornada) y su grabador |
| `instagram/carrusel/` | Generador del carrusel «Resumo da xornada» y una tirada de prueba |

Las piezas de marca fijas (avatares, cabeceras, story, post) **no** viven aquí:
salen de `npm run redes` a `assets/redes/` (SPEC-064).
