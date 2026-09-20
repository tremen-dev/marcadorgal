---
id: ADR-006
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-20, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-006: Esquema base y acceso a datos: ids, append-only, versión de Decision y RLS

- Deciders: sdd-arquitecto propone (2026-09-20); Alberto Fojo aprueba (pendiente).
- Specs relacionadas: SPEC-002 (origen); las de EPIC-002, EPIC-003 y EPIC-004 lo consumen.

## Contexto

SPEC-002 crea las tablas base. D-6 y RN-07 exigen logs inmutables; ADR-002
publica por la vista `board`; ADR-003 y ADR-004 fijan quién escribe cada tabla
(núcleo de ingesta y motor, nunca un adaptador ni el operador a mano). Falta
decidir la forma de los ids, cómo se garantiza la inmutabilidad, cómo se ordena
la Decision vigente, qué pasa con una observación sin equipo resuelto y qué ve
cada rol de Postgres. Son decisiones que heredan todas las épicas siguientes.

## Decisión

1. **Ids.** Entidades de referencia (`competitions`, `teams`, `matches`) con id
   `text` legible y estable: slug para competición y equipo (dominio.md), id
   derivado del calendario para el partido (lo fija la spec del calendario).
   `competitions` tiene clave `(id, season)`: el id no cambia de temporada.
   Logs y operación (`observations`, `decisions`, `alerts`, `ingest_attempts`)
   con `uuid` generado por `gen_random_uuid()`. `source_id` es `text` sin tabla:
   el registro de fuentes vive en código (ADR-003).
2. **Inmutabilidad por trigger, no por privilegio.** `observations` y
   `decisions` llevan triggers `BEFORE UPDATE OR DELETE` (fila) y `BEFORE
   TRUNCATE` (sentencia) que lanzan excepción. Un `REVOKE` no bastaría: el
   servidor conecta como `postgres`, dueño de las tablas.
3. **Decision vigente = mayor `version` por partido.** `version` la asigna un
   trigger `BEFORE INSERT` (`max+1`) si llega nula; índice único
   `(match_id, version)` resuelve carreras. `observation_ids uuid[]` con al
   menos un elemento y sin FK (Postgres no la soporta sobre arrays): el motor
   escribe Decision y sus Observations en la misma transacción (ADR-004).
4. **Observación sin equipo resuelto (RN-10)** no se inserta en `observations`
   (`match_id not null`): el crudo ya está en Storage y se abre una Alert
   `unresolved_team` con `raw_ref` y nombres externos en `details`. Así el log
   solo contiene observaciones atribuidas a un Match.
5. **`board` es un `LEFT JOIN`**: todo partido del calendario aparece, con
   `status='scheduled'` y marcador nulo si aún no tiene Decision, y con
   `observed_at` (reloj de la fuente, RN-11) tomado de las observaciones que
   cita la Decision vigente. `security_invoker = true`: la vista no amplía
   permisos.
6. **RLS activado en todas las tablas.** Lectura (`SELECT`) para `anon` y
   `authenticated` en `competitions`, `teams`, `matches`, `observations` y
   `decisions`: es lo que se publica y su trazabilidad (D-6). Ninguna política
   en `team_aliases`, `alerts` e `ingest_attempts`: sin política, RLS deniega.
   Ninguna política de escritura: toda escritura entra por el servidor con
   `postgres.js` y el rol `postgres`, que ignora RLS. Los permisos del operador
   (`authenticated` con claims) se añaden en EPIC-004 con otro ADR si hace
   falta.

## Consecuencias

### Positivas
Los invariantes viven donde se ejecutan (RN-07 no depende de disciplina en
código). La superficie pública por API de Supabase es exactamente lo que ya
sale por `board`. Ids legibles en calendario, alias y URLs; uuid solo donde no
hay identidad natural.

### Negativas / follow-ups
`observation_ids` sin FK: una Decision podría citar ids inexistentes si alguien
escribe fuera del motor; se acepta a cambio de no crear tabla puente. Las
`alerts` sí son mutables (`resolved_at`): su historial no es log, y si hiciera
falta auditarlo se añade en EPIC-004. `board` no usa índice para el «último por
partido»: con ~50 partidos por jornada no importa; si crece, vista
materializada o columna `current` en `matches`, con ADR.

## Alternativas consideradas

- **uuid para todo**: pierde ids legibles en calendario y alias, que se editan
  a mano (dominio.md, «se corrige editando el JSON»).
- **Inmutabilidad por `REVOKE UPDATE, DELETE`**: no aplica al dueño de la tabla.
- **Tabla puente `decision_observations` con FK**: integridad fuerte a cambio de
  una tabla y un join más en cada escritura del motor; reconsiderar si aparece
  un escritor ajeno al motor.
- **`observations.match_id` nulo para pendientes**: ensucia el log con filas
  que ninguna Decision puede citar y complica la unión discriminada del modelo.
- **`board` con `INNER JOIN`** (solo partidos con Decision): obliga a crear una
  Decision sintética por partido al cargar el calendario.
- **Vista `security_definer`** y ninguna política en tablas: superficie mínima,
  pero cualquier columna nueva en la vista se publica sin querer y el linter de
  Supabase lo marca; se prefiere declarar qué tablas son públicas.
- **Postgres Changes con RLS por suscriptor**: descartado ya en ADR-002.
