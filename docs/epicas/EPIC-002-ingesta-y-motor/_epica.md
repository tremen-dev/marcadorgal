---
id: EPIC-002
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-09-21, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-002 — Ingesta y motor

## Objetivo

Que el sistema registre por sí solo lo que pasa en los partidos: una fuente
automática observa, el motor decide y la base guarda un marcador trazable por
partido, sin que nadie esté delante. Es el corazón del producto y el punto al
que la versión previa nunca llegó con datos reales. EPIC-001 dejó calendario,
base, proveedor contratado (API-Football Pro) y latencia medida; esta épica
convierte eso en Observations y Decisions de una jornada de verdad.

## Criterios de éxito

1. Existe el contrato `SourceAdapter` (ADR-003) y un registro de fuentes como
   configuración validada, con API-Football como primera fuente `pull`
   registrada para las cinco competiciones de D-3.
2. El tick (`POST /api/ingest/tick`, ADR-002) corre desplegado en Vercel
   producción, disparado por pg_cron de Supabase `dev` cada 30 s y por Vercel
   Cron cada minuto como respaldo, y solo llama al proveedor cuando hay
   partidos en ventana. Fuera de ventana termina sin peticiones.
3. Toda respuesta cruda se guarda en Supabase Storage antes de parsearse, con
   retención automática de 30 días (D-6, RN-09); cada Observation referencia
   su captura.
4. El motor (ADR-004, RN-01..RN-06) es una función pura, replayable, que
   escribe Decisions y Alerts en la misma transacción que las Observations.
5. **Una jornada real completa** —todos los partidos de la ronda en las
   competiciones que disputen jornada ese fin de semana— queda registrada
   sin intervención manual: todos los partidos con Decision `finished` y
   marcador correcto contrastado con el proveedor —o el estado que `board` y
   el proveedor confirmen los dos, con su explicación escrita—, y las Alerts
   abiertas son explicables (silencio, retroceso, equipo sin resolver). El informe dice
   cuántas competiciones se midieron; que las cinco producen Decisions se
   comprueba antes de cerrar EPIC-003.
6. Métricas de esa jornada medidas y anotadas en el ledger: latencia gol →
   Decision (mediana y p95), peticiones al proveedor, partidos sin señal,
   alertas. Objetivo de `vision.md`: mediana < 45 s, p95 < 90 s.
7. Un partido con equipo sin alias resuelto no entra en `observations`: abre
   una Alert `unresolved_team` y no rompe el tick (RN-10).

## Enmienda del titular (Alberto Fojo, 2026-09-29) — N-9 de SPEC-009

**EPIC-002 no cierra hasta que el marcador de la jornada medida esté
corregido.** El criterio 5 pide *registrada sin intervención* **y** *marcador
correcto*: la jornada del 2026-09-25/28 cumplió lo primero y no lo segundo
(7 de 39 mal, por la regla RN-03, no por la ingesta). Una jornada registrada
pero incorrecta no cierra la épica. La corrección no la repite: se hace por
replay y reconciliación posteriores, fechados y escritos por reglas del
sistema, que no invalidan el criterio 5 (SPEC-012 H-2).

Estado medido al 2026-09-29 (evidencia en los ledgers, no aquí):

- **Criterio 5**: cuatro competiciones de cinco (Primera no jugó,
  R-SPEC-009-1). Ingesta sana (0 intentos fallidos de 2733, cobertura
  99,85 %). Marcador: 32/39 → **37/39** con SPEC-012 → **39/39** con SPEC-013
  CA-6. Cumplido en `dev`; cierra con el merge de SPEC-012 y SPEC-013.
- **Criterio 6**: medido. Latencia gol → Decision **mediana +53 s** (n = 15,
  referencia manual con precisión de minuto): **no alcanza** el objetivo de
  45 s de `vision.md`; p95 no calculable con n < 20. Se decide en EPIC-003,
  como dice el riesgo de abajo (R-SPEC-009-6, de producto).
- **Cobertura de la fuente** (riesgo cumplido): 4 de 9 partidos de Tercera
  sin directo, degradándose con la categoría (R-SPEC-009-3, de producto).

**Para cerrar faltan**: CA-5 de SPEC-013 (jornada del 2026-10-02/04, lectura
el 2026-10-05) y **SPEC-014** (ADR-011: en vivo, el marcador lo baja la misma
fuente que subió el gol u otra de más peso), que la medición de las bajadas
en vivo hizo necesaria: retener en vivo publicó ~742 ticks de marcador falso.

## Alcance

- Dentro: contrato y registro de fuentes; adaptador de resultados de
  API-Football (`/fixtures?live=` y por ids en ventana) con fixtures reales;
  raw store en Storage con retención; ventanas por partido; tick con
  autenticación y registro en `ingest_attempts`; motor de decisiones con
  cualificador derivado; alertas; job de pg_cron y Vercel Cron; variables de
  entorno en Vercel; una jornada de medición con informe. Sincronización
  semanal del calendario (`calendario:sync` + `load`) como job.
- Fuera (aparcado a propósito, no por descuido): pantalla Xornada, snapshot
  público y Realtime (EPIC-003); panel de operador y fuentes push (EPIC-004);
  segunda fuente automática; Supabase `prod`; notificaciones; ligas
  territoriales.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

Desglose orientativo, a decidir por sdd-arquitecto: (a) contrato `SourceAdapter`,
registro y adaptador de API-Football con fixtures; (b) raw store en Storage,
ventanas y tick con `ingest_attempts`; (c) motor de decisiones, cualificador y
alertas; (d) despliegue del tick (pg_cron, Vercel Cron, variables) y jornada
de medición con informe.

## Riesgos

- El proveedor puede tardar más en Tercera que en Primera; la medición del
  2026-09-20 sugiere ≤ 1-2 min con sondeo de 90 s, pero no se ha medido
  contra una referencia externa. Si p95 > 90 s, se documenta y se decide en
  EPIC-003 si el objetivo cambia o la fuente.
- pg_cron a 30 s y pg_net llamando a Vercel no se han probado aún; si fallan,
  el respaldo de Vercel Cron a 1 min sostiene la jornada y se abre ADR.
- Supabase `dev` en plan Free se pausa tras 7 días sin actividad; el propio
  tick la mantiene viva, pero conviene vigilarlo hasta EPIC-003.
- Vercel producción servirá el tick sin pantalla: la página de espera sigue
  siendo lo único público. Ninguna Decision se publica todavía (EPIC-003).
