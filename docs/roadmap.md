---
tipo: roadmap
---
# Roadmap — marcador.gal

> Curado por sdd-producto. Secuencia de épicas, horizonte y criterios de corte.
> El estado fino por spec vive en el tablero; aquí vive la INTENCIÓN.

## Ahora (en curso)

- **EPIC-002 — Ingesta y motor.** Contrato `SourceAdapter`, registro, adaptador
  de la primera fuente con fixtures reales, raw store, tick con ventanas,
  motor de decisiones, alertas. Cierra cuando una jornada real completa queda
  registrada como Observations y Decisions sin intervención manual.

## Después (comprometido, sin empezar)

- **EPIC-003 — Xornada pública.** Pantalla Xornada en móvil y escritorio según
  `docs/diseno/`, snapshot servido, Realtime con fallback a polling, tira de
  días, filtros, frescura, gl/es. Cierra con el dominio marcador.gal
  publicando una jornada real.
- **EPIC-004 — Operador y fuentes push.** Panel mínimo con Auth, webhook
  genérico, segunda fuente automática registrada. Cierra cuando el operador
  corrige un marcador desde el móvil y el público lo ve en menos de 10 s.

## Hecho

- **EPIC-001 — Cimientos.** Repo con CI, esqueleto Next.js, modelo zod,
  migraciones base (competitions, teams, matches, observations, decisions,
  alerts), tokens de diseño como código, i18n vacío, calendario de las cinco
  competiciones cargado. Cierra cuando `npm run gates` pasa en CI y la base de
  datos de dev tiene la jornada en curso cargada.
  **Cerrada el 2026-09-21** con sus cuatro specs hechas (SPEC-001..004).

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
- Ligas territoriales gallegas (Preferente, Primeira Galega) si aparece fuente.
- Feed o widget para medios y clubes.

## Criterios de corte

- Sube una épica si desbloquea una métrica norte de `vision.md`.
- Baja o se aparca si depende de una fuente que no existe o de un acuerdo que
  no está firmado.
- Ninguna épica de interfaz entra antes de que EPIC-002 tenga una jornada real
  registrada: primero el dato, luego la pantalla.
