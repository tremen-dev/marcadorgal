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
  se vuelve a medir con mejor referencia en Primera (2026-10-09/12) y aquí se
  decide si cambia el objetivo, la cadencia o la fuente. **R-SPEC-009-7** —
  medir la latencia interna exige un segundo reloj (ADR-008 §7); se trae de
  EPIC-002 porque no afecta a que el marcador sea correcto, solo a desglosar
  la latencia, y hace falta cuando se decida R-SPEC-009-6.
  *Por qué ahora (titular, 2026-10-06):* el dato ya es correcto sin operador
  (EPIC-002, SPEC-018) y tres de las cinco métricas norte de `vision.md`
  (latencia mediana y p95, primera pintura) solo se miden con pantalla.
  EPIC-004 no arregla rápido el directo de Tercera: la segunda fuente no está
  identificada y el operador choca con «sin nadie detrás un sábado normal».
  La pantalla muestra `sen sinal` donde la fuente no da directo.

- **EPIC-004 — Fuente RFEF.** Segunda fuente automática: `marcadores.rfef.es`,
  oficial, prioridad 50 sobre API-Football, las cinco competiciones. Cierra
  cuando una jornada medida no deja `sen sinal` donde la RFEF publica en
  juego, sin empeorar cobertura, corrección ni latencia (< 45 s mediana).
  *Por qué ahora (titular, 2026-10-10):* la segunda fuente ya existe (sondeo
  del 2026-10-10: pública con cookie de sesión, cubre las cinco
  competiciones, marcador ofuscado) y es la salida al directo de Tercera sin
  esperar al operador. Corre en paralelo a EPIC-003.

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

## Más adelante (idea, sin compromiso)

- Clasificaciones por competición.
- Equipos favoritos (sin cuenta: almacenamiento local).
- Detalle de partido con eventos (goles, tarjetas).
- Notificaciones de gol.
- Ligas territoriales gallegas (Preferente, Primeira Galega): candidata
  `marcadores.rfef.es` con `federacion=3` (sondeo 2026-10-10), tras EPIC-004.
- Feed o widget para medios y clubes.

## Criterios de corte

- Sube una épica si desbloquea una métrica norte de `vision.md`.
- Baja o se aparca si depende de una fuente que no existe o de un acuerdo que
  no está firmado.
- Ninguna épica de interfaz entra antes de que EPIC-002 tenga una jornada real
  registrada: primero el dato, luego la pantalla.
