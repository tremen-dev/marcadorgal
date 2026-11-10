---
id: EPIC-009
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-009 — Producción con público: capacidad y visitas medidas

## Objetivo
Llevar la web a público sabiendo dos cosas que hoy no sabemos: **cuánta gente
la usa** y **si aguanta la que esperamos**. Hoy no hay ninguna analítica, y
ADR-002 dimensionó para 500 navegadores sin haberlo medido. La medición tiene
dos usos (titular, 2026-11-10): las cifras de audiencia para vender patrocinio
(es el primer entregable que desbloquea EPIC-008) y vigilar la capacidad.

Objetivo de capacidad (titular, 2026-11-10): **hasta ~1.000 visitantes a la
vez**. No se esperan más de momento. A esa escala la arquitectura de hoy se
mide y se ajusta, no se rehace. La antigüedad de la primera pintura se queda
como está: ≤ 40 s por la caché de CDN de SPEC-030, y luego Realtime o la
consulta periódica la ponen al día.

## Criterios de éxito
1. **Visitas medidas sin cookie.** Cada jornada da visitantes únicos y páginas
   vistas, desglosados por ruta (`/`, `/es`, `/xornada/[fecha]`), dispositivo,
   país y origen del tráfico (X, WhatsApp, buscadores, directo). No hay cookie,
   ni banner de consentimiento, ni petición a dominios de terceros (la misma
   regla que EPIC-008, criterio 1). La primera pintura medida en SPEC-026 no
   empeora.
2. **Informe de una jornada real.** Las cifras agregadas de un fin de semana de
   partidos se pueden reproducir y exportar sin trabajo a mano. Ese informe es
   la «cifra en la mano» con la que EPIC-008 deja de estar aparcada.
3. **1.000 a la vez, demostrado.** Una prueba de carga sintética con 1.000
   navegadores conectados durante al menos 15 minutos de partido en juego
   termina sin errores 5xx. Se cumplen:
   - la latencia gol → pantalla de `vision.md`,
   - la primera pintura ≤ 40 s.

   Si se supera un límite del plan (por ejemplo, conexiones de Realtime), el
   navegador pasa a la consulta periódica y el marcador sigue siendo correcto
   (D-9).
4. **Pico real visible.** El titular puede consultar el pico de visitantes
   simultáneos de cada jornada y compararlo con el objetivo de 1.000, sin
   abrir el panel de cada proveedor.

## Alcance
- Dentro: medición de visitas sin cookie, informe por jornada, prueba de
  carga a 1.000, revisión de límites de los planes (Vercel, Supabase Realtime y
  base) y ajuste de lo que la prueba muestre que no llega.
- Fuera (aparcado a propósito, no por descuido):
  - **Invalidar la caché en cada cambio de partido.** Se descarta (titular,
    2026-11-10): ≤ 40 s vale, y a esta escala la carga ya la absorbe la CDN. Se
    reabre si la medición de SPEC-026 o las quejas lo piden.
  - **Más de 1.000 a la vez**, CDN delante (Cloudflare u otra) o cambio de la
    vía de reparto. Si el pico real se acerca al objetivo, esto se convierte en
    una épica nueva.
  - **Identificar usuarios**: sin cuentas, sin cookie, sin huella persistente
    entre días.
  - **Analítica de producto fina**: clics, embudos, mapas de calor, A/B.
  - **El informe comercial maquetado** para el patrocinador, que pertenece a
    EPIC-008. Aquí solo se entregan las cifras.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo; lo decide sdd-arquitecto.

| # | Pieza | Nota |
|---|---|---|
| 1 | ADR: herramienta de medición | Opciones: Vercel Web Analytics (sin cookie, desde el propio dominio), Cloudflare Web Analytics (sin cookie, pero su script viene de un tercero salvo que el dominio pase por Cloudflare) o un recuento propio en el servidor. |
| 2 | Medición en producción | Criterio 1. |
| 3 | Informe por jornada y pico | Criterios 2 y 4. |
| 4 | Prueba de carga a 1.000 y ajustes | Criterio 3. |

## Riesgos
- **Límites de Realtime.** *Hipótesis por validar:* el plan de Supabase
  limita las conexiones simultáneas por debajo de 1.000. En ese caso el
  criterio 3 se resuelve con la vía de reserva, la consulta periódica, o
  subiendo de plan. La prueba de carga lo decide.
- **Prueba de carga contra producción.** La única Supabase remota es la de
  producción. La prueba no puede tocar el dato ni coincidir con partidos
  reales. Cómo hacerla es decisión del arquitecto.
- **Cifras infladas por bots.** Un patrocinador compra personas. La medición
  tiene que excluir bots conocidos y las sondas propias (SPEC-025 y SPEC-026).
- **Coste.** Algunos proveedores cobran por evento. *Hipótesis:* a la escala
  de hoy entra en el plan actual. El ADR la confirma.
- **RGPD.** Sin cookie no hace falta consentimiento, siempre que no se guarde
  la IP ni un identificador persistente. El ADR lo deja escrito.
