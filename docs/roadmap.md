---
tipo: roadmap
---
# Roadmap — marcador.gal

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)

- **EPIC-003 — Xornada pública.** Pantalla Xornada en móvil y escritorio según
  `docs/diseno/`, snapshot servido, Realtime con fallback a polling, tira de
  días, filtros, frescura, gl/es. Cierra con el dominio marcador.gal
  publicando una jornada real.
  *Entradas de la jornada medida (2026-09-29):* **R-SPEC-009-6** — latencia
  mediana +53 s contra 45 s de `vision.md`, con n = 15 y referencia a minuto:
  se vuelve a medir con mejor referencia (SPEC-025, segundo reloj de ADR-016,
  campo en la jornada 2026-10-16/19, informe antes del 14-nov) y aquí se
  decide si cambia el objetivo, la cadencia o la fuente. **R-SPEC-009-7** —
  medir la latencia interna exige un segundo reloj (ADR-008 §7); se trae de
  EPIC-002 porque no afecta a que el marcador sea correcto, solo a desglosar
  la latencia, y hace falta cuando se decida R-SPEC-009-6.
  *Por qué ahora (titular, 2026-10-06):* el dato ya es correcto sin operador
  (EPIC-002, SPEC-018) y tres de las cinco métricas norte de `vision.md`
  (latencia mediana y p95, primera pintura) solo se miden con pantalla.
  La pantalla muestra `sen sinal` donde la fuente no da directo. *(Superado el
  2026-10-10: el razonamiento de entonces, «la segunda fuente no está
  identificada», dejó de valer al aparecer la RFEF; ver EPIC-004.)*
  *Estado (2026-10-15):* la pantalla está en producción con las mejoras de
  lectura (SPEC-030, 033, 034). Para cerrar faltan las mediciones de campo de
  SPEC-025 (latencia) y SPEC-026 (primera pintura con 3G), en la jornada
  2026-10-16/19.

- **EPIC-004 — Fuente RFEF.** Segunda fuente automática: `marcadores.rfef.es`,
  oficial, prioridad 50 sobre API-Football, las cinco competiciones. Cierra
  cuando una jornada medida no deja `sen sinal` donde la RFEF publica en
  juego, sin empeorar cobertura, corrección ni latencia (< 45 s mediana).
  *Por qué ahora (titular, 2026-10-10):* la segunda fuente ya existe (sondeo
  del 2026-10-10: pública con cookie de sesión, cubre las cinco
  competiciones, marcador ofuscado) y es la salida al directo de Tercera sin
  esperar al operador. Corre en paralelo a EPIC-003.
  *Estado (2026-11-01, titular):* la vía directa se agotó (SPEC-032, sin
  cadencia) y la RFEF no contesta (SPEC-036). El alta entra por el servicio
  externo explorer con **prioridad 5 temporal** (ADR-023 supersede ADR-021
  §7): primero observar al proveedor en una jornada medida, después decidir
  la prioridad definitiva por competición. El criterio de latencia no se le
  exige mientras no mande.
  *2026-11-02:* SPEC-038 y SPEC-044 hechas. Con API-Football sin plan esa
  semana, la rfef recuperó los finales de la jornada 2026-10-30/11-02.

- **Propuesta (2026-11-02, titular): calendario desde la RFEF.** Que la RFEF,
  vía explorer, sea la fuente del calendario declarado (D-3) en lugar de
  API-Football. Arregla dos fallos medidos: nombres no federativos (D-2;
  «RC Celta C» es Gran Peña FC) y horas de relleno que no siguen las
  reprogramaciones (4 partidos de Segunda J12 jugados el lunes 2026-11-02 con
  kickoff declarado el domingo). Hoy está fuera de alcance de EPIC-004: entra
  como épica propia o como enmienda de EPIC-004. Mantiene `TeamId` y `MatchId`;
  cambian `name` y `kickoff`. Necesita ADR (qué fuente manda si discrepan,
  horas por confirmar, validar que una sincronización no crea ni borra
  partidos). *Hipótesis a validar:* si la página de calendario de la RFEF trae
  la hora o solo la fecha, porque eso fija cuántas peticiones cuesta.
  **Pregunta abierta: qué papel le queda a API-Football.** Hoy da calendario,
  directo con prioridad 10, el minuto de juego (la RFEF no lo da) y los
  goleadores con minuto. Opciones: (A) respaldo de pago, 19 $/mes, dos fuentes
  independientes; (B) solo RFEF, 0 $, sin minuto, sin goleadores y con una sola
  cadena (RFEF → explorer → proxies); (C) RFEF más el plan gratuito de
  API-Football como reserva mínima, con límite de peticiones por confirmar.
  Objetivo del titular a medio plazo: dejar de pagar API-Football (H-9 de
  SPEC-036). **Se decide con el informe de SPEC-039** (jornada 2026-11-06/09:
  latencia de la RFEF, bloqueos de explorer, contraste con acta). Si la RFEF
  cumple, B o C, con parte del ahorro en proxies residenciales de pago (unos
  2-3 $/mes) para no depender de los gratuitos. El minuto aproximado desde el
  kickoff y los goleadores desde la ficha de la RFEF se valoran aparte.

- **EPIC-007 — Redes: goles en directo en X.** *(Aprobada por el titular el
  2026-11-09.)* Un tweet por gol de los
  equipos vigilados, solo en directo, en galego y con plantillas al azar,
  publicado a través de Buffer (plan Free, API) con la X API de pago por uso
  como reserva. Cierra cuando una jornada real medida produce un tweet por
  gol de equipo vigilado, sin duplicados ni intervención.
  *Por qué ahora (titular, 2026-11-09):* el dato ya es correcto y llega en
  directo; la cuenta de X tiene identidad (SPEC-064) y ningún contenido. No
  compite con EPIC-003 ni EPIC-004 por el dato: solo lo consume. La
  investigación de vías gratuitas descartó la automatización por navegador
  (X la castiga con suspensión permanente).

- **EPIC-009 — Producción con público: capacidad y visitas medidas.**
  *(Aprobada por el titular el 2026-11-10.)* Medir visitas sin cookie ni
  terceros (únicos, páginas, origen, dispositivo), con un informe
  reproducible por jornada y una prueba de carga a 1.000 visitantes a la vez.
  Se cierra cuando una jornada real queda medida y la prueba pasa sin
  errores.
  *Por qué ahora:* es el primer entregable que desbloquea EPIC-008 (la cifra
  de audiencia) y el que dirá si las campañas de EPIC-007 traen gente. No
  compite por el dato con EPIC-003/004. La invalidación de caché en cada
  cambio queda fuera: el titular da por buena la antigüedad de ≤ 40 s.
  *Estado (2026-11-10):* SPEC-077 hecha. Mide con Vercel Web Analytics
  (ADR-033). Faltan el informe y el pico, que dependen de G-2 de ADR-033, y
  la prueba de carga.

## Después (comprometido, sin empezar)

- **EPIC-005 — Operador y fuentes push.** Panel mínimo con Auth, webhook
  genérico. *Renumerada el 2026-10-10*: la segunda fuente automática salió
  a EPIC-004 (fuente RFEF). Cierra cuando el operador
  corrige un marcador desde el móvil y el público lo ve en menos de 10 s.
  *Entrada de la jornada medida (2026-09-29):* **R-SPEC-009-3** — la fuente
  no dio en directo 4 de 9 partidos de Tercera; la cobertura se degrada con la
  categoría. Operador o segunda fuente son las dos salidas: es el argumento
  para no retrasar esta épica tras EPIC-003. **Orden decidido el 2026-10-06: va
  después de EPIC-003** (ver «Ahora»).
  Recontado el 2026-10-04 (`EPIC-002/_qa/fuente-sin-directo/medicion.md`):
  descontado el calendario mal declarado, la fuente no dio en directo 2 de 9
  partidos de Tercera en J4 y 4 de 8 en J5, y 1 de 9 de Segunda RFEF en cada
  jornada; Primera RFEF y Segunda, ninguno. ADR-013 / SPEC-018 traen el
  resultado final sin operador; el directo sigue necesitando operador o
  segunda fuente.

- **EPIC-006 — Modelo de ingresos: patrocinio.** *(Aprobada por el titular el
  2026-10-18; SPEC-037, el estudio, hecha ese día. Lo que se pinta vive en
  EPIC-008.)* Estudio de mercado,
  spike sin código: cuánto pagaría un patrocinador gallego por una jornada o
  una competición, y de ahí el techo de coste mensual para datos. Cierra
  cuando el titular acepta un techo en € con fórmula reproducible.
  *Por qué en «Después» y no en «Más adelante»:* SPEC-036 puede acabar en un
  proveedor de pago y sin techo no se puede decidir. Eso ata la épica a
  EPIC-004, que está en «Ahora».
  *Por qué no en «Ahora»:* no desbloquea por sí misma ninguna métrica norte y
  la audiencia aún no está medida. Al no tener código, no compite con
  EPIC-005 por implementación: puede adelantarse si SPEC-036 lo necesita
  (H-6). Pintar el patrocinio en pantalla queda fuera hasta que haya un
  acuerdo firmado (criterio de corte).

## Hecho

- **EPIC-001 — Cimientos.** Repo con CI, esqueleto Next.js, modelo zod,
  migraciones base (competitions, teams, matches, observations, decisions,
  alerts), tokens de diseño como código, i18n vacío, calendario de las cinco
  competiciones cargado. Cierra cuando `npm run gates` pasa en CI y la base de
  datos de dev tiene la jornada en curso cargada.
  **Cerrada el 2026-09-21** con sus cuatro specs hechas (SPEC-001..004).

- **EPIC-002 — Ingesta y motor.** Contrato `SourceAdapter`, registro, adaptador
  de la primera fuente con fixtures reales, raw store, tick con ventanas,
  motor de decisiones, alertas. Cierra cuando una jornada real completa queda
  registrada como Observations y Decisions sin intervención manual **y con el
  marcador corregido** (N-9, 2026-09-29).
  **Cerrada el 2026-10-06** con sus diez specs hechas (SPEC-005..009, 012..014,
  016, 018).

## Permanente (sin fecha, no compite por prioridad)

- **EPIC-MANT — Mantenimiento.** Cubo para fallos silenciosos que aún no han
  mordido, deuda con modo de fallo escrito y observaciones de verificación no
  bloqueantes. Existe para que eso no muera en el ledger de una spec cerrada,
  que nadie relee. Se vacía entre épicas o cuando algo de dentro se vuelve
  urgente. Un fallo que ya hace daño no vive aquí: es EPIC-FIX y salta la cola.
- **EPIC-MEJORA — Mejoras.** *(Borrador, 2026-11-11.)* Cubo hermano de
  EPIC-MANT para pulidos de producto, UX y calidad que no son fallo ni
  capacidad con épica propia: lo que las verificaciones mandan «a EPIC-MEJORA»
  y las ideas menores del titular. Si aparece un modo de fallo, la entrada pasa
  a EPIC-MANT. Se vacía en los huecos entre épicas.

## Más adelante (idea, sin compromiso)

- Clasificaciones por competición.
- Equipos favoritos (sin cuenta: almacenamiento local).
- Detalle de partido con eventos (goles, tarjetas).
- Notificaciones de gol.
- Ligas territoriales gallegas (Preferente, Primeira Galega): candidata
  `marcadores.rfef.es` con `federacion=3` (sondeo 2026-10-10), tras EPIC-004.
- Feed o widget para medios y clubes.
- **EPIC-008 — Patrocinio en pantalla y en redes.** *(Borrador, aparcada por
  el titular el 2026-11-09.)* Qué recibe quien paga: patrocinador de jornada
  (franja, nombre, imagen al compartir, tweets de apertura y resumen) y
  patrocinador de equipo (etiqueta en la fila, tweets de gol y de final).
  Cierra cuando una jornada real patrocinada cumple la tabla de piezas sin
  terceros y con informe reproducible.
  *Por qué aquí:* sin visitas medidas no hay precio alto que pedir, y el
  criterio de corte aparca lo que depende de un acuerdo sin firmar. Sube a
  «Después» cuando el titular decida medir la audiencia (su primer
  entregable, que ahora es EPIC-009); depende de que EPIC-007 tenga publicador.

## Criterios de corte

- Sube una épica si desbloquea una métrica norte de `vision.md`.
- Baja o se aparca si depende de una fuente que no existe o de un acuerdo que
  no está firmado.
- Ninguna épica de interfaz entra antes de que EPIC-002 tenga una jornada real
  registrada: primero el dato, luego la pantalla.
