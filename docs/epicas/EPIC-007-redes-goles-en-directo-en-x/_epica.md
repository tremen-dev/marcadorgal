---
id: EPIC-007
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-08, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-11-08, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-007 — Redes: goles en directo en X

## Objetivo
Que la cuenta de X de marcador.gal cuente los goles de los equipos gallegos
mientras ocurren, sin nadie detrás. Hoy el dato ya es correcto y llega en
directo a la pantalla (EPIC-002, EPIC-004); la cuenta de X solo tiene
identidad (SPEC-064) y ningún contenido. Un tweet por gol, en galego, lleva
el marcador adonde está la afición un sábado por la tarde y trae gente a la
pantalla sin pagar publicidad. El titular lo decidió el 2026-11-09 tras una
investigación de vías gratuitas: se publica a través de **Buffer (plan Free,
API)**, que conecta la cuenta de X sin créditos de la X API; la X API de pago
por uso queda como reserva; la automatización por navegador se descarta
porque X la castiga con suspensión permanente de la cuenta.

## Criterios de éxito
1. **Cada gol en directo de un equipo vigilado produce un tweet**, y solo
   uno, aunque pg_cron y Vercel Cron se solapen. Medido en una jornada real:
   tweets publicados = goles en `live` de equipos vigilados, con cero
   duplicados.
2. **Latencia gol → tweet ≤ latencia gol → pantalla + 30 s** (mediana) en la
   misma jornada. El tweet sale en el mismo tick que decide el gol.
3. **Ningún tweet falso.** Solo Decisions `confirmado`, en `live` y con el
   marcador subiendo; un gol anulado (marcador que baja en `live`) produce un
   tweet de corrección. Un gol visto solo al cierre no se publica.
4. **Variedad.** Con N ≥ 5 plantillas en galego, dos goles seguidos del mismo
   equipo no repiten plantilla salvo azar documentado; X rechaza duplicados
   exactos y no debe rechazar ninguno.
5. **Sin intervención.** Un fallo de Buffer o de X no tumba el tick ni altera
   ninguna Decision; queda trazado en base con su error y se reintenta o se
   descarta según regla escrita.
6. **Configurable sin desplegar.** La lista de equipos vigilados y la
   ligazón al partido se cambian en configuración de producción, no en código.

## Alcance
- Dentro: detección del gol a partir de las Decisions (misma regla que el
  «GOL» que pulsa, ADR-022); registro trazable de cada publicación con la
  Decision que la originó; publicación vía Buffer con un puerto que permita
  cambiar a la X API sin tocar el resto; equipos vigilados configurables
  (por defecto, los gallegos de `data/galegos/`); N plantillas de gol y de
  gol anulado en galego, elegidas al azar; ligazón al partido o a la
  xornada configurable y apagada por defecto; cumplimiento de las normas de
  X para cuentas automatizadas (etiqueta «Automated», operador en la bio).
- Fuera (aparcado a propósito, no por descuido):
  - Nombre del goleador en el tweet: en directo no llega con la Decision
    (SPEC-059 lo trae de Explorer al leer). Se valorará como spec aparte.
  - Tweets de inicio, descanso, final o resultado de la jornada; hilos por
    partido; imágenes o tarjetas por gol.
  - Otras redes (Bluesky, Mastodon, Telegram) y el castellano: la cuenta
    publica en galego (D-2); `/es` no tiene cuenta.
  - Respuestas, menciones, seguir o dar «me gusta»: la cuenta solo publica.
  - Crear la cuenta de Buffer, conectar X y custodiar la clave: lo hace el
    titular, como con las fuentes (D-7). El código solo lee la variable.
  - Panel de operador para activar o silenciar la cuenta: EPIC-005.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo (lo autora sdd-arquitecto): un ADR de la integración
saliente (dónde se detecta el gol, registro trazable, puerto de publicación,
reintentos); una spec de detección, registro y publicación vía Buffer con
plantillas y configuración; una spec de jornada medida (criterios 1, 2 y 4).

## Riesgos
- **Buffer cambia el plan Free o sus límites** (1.000 peticiones por canal y
  mes; 50 o 100 posts por 24 h en X según su propio soporte, que se
  contradice). Mitigación: puerto intercambiable y la X API de pago por uso
  como reserva (0,015 $ por post sin enlace, 0,20 $ con enlace).
- **Un día de muchos goles supera el tope diario de X** (31 equipos gallegos,
  sábado y domingo). Mitigación: el tope diario se mide en la jornada y la
  lista de equipos vigilados recorta si hace falta.
- **Gol falso publicado.** El marcador puede bajar (RN-03 por fuente). El
  tweet de corrección lo cubre, pero el primero ya salió. Se acepta: la
  pantalla tiene el mismo comportamiento.
- **Normas de X para automatización.** Sin etiqueta «Automated» o con
  duplicados exactos, X puede limitar la cuenta. Lo cubre el criterio 4 y la
  configuración de la cuenta por el titular.
- **Identidad.** `vision.md`: «No una red social». La cuenta es un canal de
  salida de lo que ya publica la pantalla, no un espacio de conversación.

## Preguntas para el titular
- **H-1. Cualificador.** ¿Solo `confirmado` o también `provisional`?
  *Resuelta (Alberto Fojo, 2026-11-09):* solo `confirmado`.
- **H-2. Gol anulado.** ¿Silencio o tweet de corrección? *Resuelta (Alberto
  Fojo, 2026-11-09):* una bajada del marcador en `live` es un gol anulado y
  se notifica.
- **H-3. Gol visto solo al cierre.** ¿Se publica? *Resuelta (Alberto Fojo,
  2026-11-09):* no; solo en directo.
- **H-4. Ligazón.** ¿Lleva enlace a marcador.gal? *Resuelta (Alberto Fojo,
  2026-11-09):* configurable; por defecto sin enlace, activable por
  configuración.
- **H-5. Posición en el roadmap.** Se propone en «Ahora», en paralelo a
  EPIC-003 y EPIC-004, porque no compite con ellas por el dato (solo lo
  consume) y el titular quiere empezar ya. *Resuelta (Alberto Fojo,
  2026-11-09):* «Ahora».
