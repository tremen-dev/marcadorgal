---
id: SPEC-015
tipo: spec
epica: EPIC-FIX
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
---
# SPEC-015 — El calendario declarado llega tarde a la jornada

## Problema
El proveedor publica cada jornada primero con una **hora de relleno** (domingo
15:00Z/16:00Z, `status NS`, no `TBD`) y da la hora real días después. El sync
corre **solo los martes** (SPEC-008 CA-8), así que lo que llega del miércoles al
sábado entra en base cuando la jornada ya se jugó. La ventana (ADR-002 §2) y el
cierre forzoso de RN-02 (kickoff + 120) cuelgan del kickoff declarado.
Evidencia y consultas en `_qa/diagnostico-2026-09-29.md`.

**Daño ya hecho:** 4 partidos de la jornada medida jugados a otra hora
(R-SPEC-009-5). Dos de ellos, sin ninguna observación `live`; antela-somozas,
con 113 descartadas; extremadura-zamora, con 50 min perdidos.
**Daño inminente:** los 11 partidos de Segunda J8 (02-05 oct) están en `dev` a
la hora de relleno. Uno cae en viernes, cuatro en sábado y uno en lunes. Dos
empiezan 1,5 h más tarde, y ahí RN-02 cerraría en el minuto ~30 con un marcador
falso. Eso contamina CA-5 de SPEC-013. El PR #19 los corrige (ver H-2).

## Usuarios / roles afectados
- Titular: hoy fusiona a mano cada PR del calendario, que solo sale el martes.
- sdd-verificador de SPEC-013: CA-5 se mide en la jornada afectada.
- Público (EPIC-003): vería `scheduled` un partido que se está jugando.

## Criterios de aceptación
- **CA-1 El sync corre cada día de martes a sábado.** Dado `calendario-semanal.yml`, entonces su `schedule` es `'0 5 * * 2-6'` y conserva `workflow_dispatch`. Test en `src/arch/deploy.test.ts`. Presupuesto: 5 peticiones por ejecución, 25 a la semana. El ledger lo anota.
- **CA-2 Una sola rama y un solo PR vivos.** Dadas dos ejecuciones con diff en días distintos y el PR de la primera sin fusionar, entonces la segunda **actualiza** ese PR sobre la rama fija `chore/calendario`, sin abrir otro. Si el PR se fusionó o se cerró, la rama se rehace desde `main`. Test: `deploy.test.ts` afirma la rama fija (sustituye `chore/calendario-$fecha`). Verificación: dos `workflow_dispatch` seguidos dejan un único PR abierto, y el ledger guarda la salida de `gh pr list`.
- **CA-3 Lo urgente se ve en el diff.** `formatSyncDiff(competitionId, diff, now)` recibe `now: Instant`, sin reloj propio. El reloj lo pone `tools/calendario-sync.mjs`. Marca `URGENTE` en cada línea `~`, `+` o `?` cuyo kickoff viejo o nuevo cae en `[now, now + 7 d]`, y `PASADO` si los dos son anteriores a `now`. La cabecera suma `urgentes: N`. El título del PR termina en ` — N urgentes` cuando `N > 0`. Test en `sync.test.ts` con los casos del PR #19 y `now = 2026-09-29T11:00:00Z`: eldense-oviedo → `URGENTE`; celta-fortuna-real-sociedad-b (10-10) → sin marca; antela-somozas → `PASADO`.
- **CA-4 Las reprogramaciones se aplican solas (H-1).** `autoAplicable(diffs): boolean` es pura y vive en `src/calendar/sync.ts`. Devuelve `true` si en todas las competiciones solo hay `rescheduled` (`unconfirmed` e `ignoredRounds` no cuentan) y `data/alias/**` no cambia. Si es `true`, el workflow fusiona su propio PR y lanza el `load` (`gh workflow run … -f cargar=si`). Hace falta ese lanzamiento porque una fusión hecha con `GITHUB_TOKEN` no dispara `on: push`. Si es `false`, espera al humano como hoy. Test unitario: un diff solo con `rescheduled` → `true`; con cualquier `newTeams`, `added`, `missing`, `renamedAtProvider` o `rematched` → `false`. Verificación: una ejecución real con reprogramaciones deja una fila nueva en `calendar_loads`, y el ledger guarda la consulta.
- **CA-5 Medido en la jornada del 2026-10-09/12.** Consulta de solo lectura: partidos con kickoff en la jornada cuya primera observación `live` es anterior a `kickoff − 15 min`, o que llegan a `finished` sin ninguna `live` dentro de `[kickoff − 10, kickoff + 150]`. Resultado: **0**, o cada caso con su explicación (la hora cambió después del sábado a las 05:00Z, o la fuente no dio directo). La consulta y la salida van al ledger.
- **CA-6 Gates y nada de más.** `npm run gates` → 0. Ficheros: el workflow, `src/calendar/sync.ts`, `tools/calendario-sync.mjs` y sus tests, y `deploy.test.ts`. No se tocan `src/decide`, `src/ingest` ni `supabase/`. Sin migraciones ni dependencias.

## Entidades y reglas afectadas
Calendario declarado, Match, Ventana (`dominio.md`); RN-02 (reglas.md);
ADR-002 §2; SPEC-008 CA-8 y H-5, que esta spec **enmienda** (H-1).

## Fuera de alcance
- Detectar el desfase en el tick comparando `fixture.date` con el kickoff
  declarado. Es la defensa del mismo día, pero cruza la frontera de fuentes y
  pide ADR → EPIC-MANT.
- Reconocer la hora de relleno. La guarda N-5 de `live` lejos del kickoff.
- Recontar R-SPEC-009-3: dos de los 4 de Terceira «sin directo» son de
  calendario (producto).
- F-SPEC-012-4 (cierres duplicados): va a EPIC-MANT por decisión del titular
  (2026-09-29), no a esta spec.

## Notas para el gate humano
- **H-1 (DECIDIDO por Alberto Fojo, 2026-09-29: (b)).** Las reprogramaciones
  puras (solo cambia la hora de un partido existente) se aplican solas; todo lo
  demás espera la fusión humana. CA-4 entra en alcance. **Enmienda H-5 de
  SPEC-008** («un aplazamiento merece ojos antes de entrar en base»): desde esta
  spec, un cambio de hora puro entra sin ojos previos. D-3 se mantiene: el repo
  sigue siendo la verdad y cada cambio queda en un PR fusionado y auditable.
  SPEC-008 está en `hecho` y no se edita; esta nota es la enmienda.
- **H-2 (DECIDIDO por Alberto Fojo, 2026-09-29): el PR #19 se fusiona entero,**
  incluidas las horas corregidas de 4 partidos ya jugados de la jornada 25-28.
  Consecuencia aceptada: un informe o replay de 25-28 regenerado después cambia
  sus números.
- **H-3 (DECIDIDO por Alberto Fojo, 2026-09-29): puente manual.** Mientras
  SPEC-015 no esté desplegada, `workflow_dispatch` extra el jueves 01 y el
  viernes 02 de octubre (5 peticiones cada uno), para Tercera J5 y Segunda RFEF J5.
- El `schedule` de GitHub llega tarde: hoy corrió a las 10:56Z, no a las 05:00Z.
  La ejecución del sábado puede llegar después de los partidos de la mañana,
  así que la última red fiable es la del viernes.
- Si `main` exige checks para fusionar, CA-4 necesita que el PR los pase o una
  excepción para esta rama. Lo comprueba el implementador.
