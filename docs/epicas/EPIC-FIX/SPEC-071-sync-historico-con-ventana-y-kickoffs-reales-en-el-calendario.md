---
id: SPEC-071
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-10, por: sdd-implementador}
---
# SPEC-071 — Sync histórico con ventana y kickoffs reales en el calendario

## Problema
El dry-run de SPEC-070 (CA-9) dejó 20 `no_identity`. 19 se jugaron otro día que el `kickoff` declarado (`_qa/SPEC-070/ca9-vecinos.log`): Segunda J12 ×8 al domingo 11-01 16:00Z de relleno (p. ej. `segunda-division-2026-27-j12-celta-fortuna-cordoba`, jugado el 10-31 18:30 Madrid, acta 70695028, 2-2), Tercera J8–J10 ×9 a horas de relleno y 2 aplazados (Castellón–Eibar, Granada–Tenerife). `historico:sync` pide el export solo del día del kickoff, así que esos partidos se quedan sin goleadores, y la web los pinta en un día que no es. El calendario no se corrige solo: `syncCalendar` no reescribe un kickoff pasado (`isPast`) y el importador de Tercera devuelve el propio fichero declarado (`src/sources/rfef/calendar.ts`). F-SPEC-070-1, F-SPEC-069-2.

## Usuarios / roles afectados
Público de la xornada (día y goleadores) y titular (back-fill de SPEC-060).

## Criterios de aceptación
Regla común («ventana»): las candidatas de un partido local son las filas del export de los días Madrid `[día del kickoff − 3, + 3]` que cumplen la identidad de SPEC-070 (`isSameMatch`, sin cambios). Una candidata → esa. Varias → si exactamente una está `FINISHED`, esa (aplazado o suspendido y rejugado); si no, el desempate de SPEC-070 CA-5 con día **y** `horaTexto` iguales al kickoff; si no, `ambiguous`. Una sola función pura, compartida por las dos partes.
- **CA-1 (histórico en otro día)**: Dado un fixture `export-2026-10-31-celta-fortuna-cordoba.json` (crudo de explorer, procedencia en el README) y el partido local con kickoff `2026-11-01T16:00:00Z`, cuando corre la planificación con ventana, entonces se empareja con la fila 70695028, `finalScore` 2-2 y sus goles.
- **CA-2 (aplazado y rejugado)**: Dadas en la ventana una fila `POSTPONED` sin marcador y otra `FINISHED` de la misma identidad, entonces se empareja la `FINISHED`; con dos `FINISHED` → `ambiguous`, sin plan; con solo la `POSTPONED` → emparejado sin `finalScore` ni decisión.
- **CA-3 (nada se relaja)**: Una fila con un equipo distinto en un día vecino no empareja; la fila correcta en el día +4 o −4 no empareja (`unpaired`); el motivo `no_identity`/`no_competition_rows` mira toda la ventana.
- **CA-4 (informe y peticiones)**: La línea del emparejado añade la fecha de la fila cuando difiere de la del kickoff (`2026-11-01 → 2026-10-31 · …`) y el informe cuenta `matchesOtherDay`. Cada día del export se pide una sola vez por ejecución (test con `fetcher` que cuenta).
- **CA-5 (kickoff real, puro)**: Dados el calendario declarado, el alias rfef, `now` y las filas del export por día, cuando se calculan los kickoffs reales de los partidos con kickoff `< now`, entonces cada partido emparejado (regla común) con fila `FINISHED` y `horaTexto` `HH:MM` pasa a `<fecha de la fila> <horaTexto>` Europe/Madrid en UTC con `Z` (Celta Fortuna–Córdoba → `2026-10-31T17:30:00Z`; Tercera J8 Céltiga–Somozas → `2026-10-24T15:00:00Z`). Sin cambio: fila no `FINISHED`, `horaTexto` ausente o inválido, `ambiguous` (se lista), mismo instante, o kickoff `≥ now`.
- **CA-6 (en el bot)**: `calendario:sync` aplica CA-5, en todas las competiciones incluida Tercera, a los partidos con kickoff en `[now − 8 d, now)`, y en `[--reales-desde, now)` si se pasa ese flag. Cada corrección sale en el diff como `~ id: de -> a  PASADO` y cuenta como reprogramación para `autoAplicable` (autofusión, decisión del titular). Un segundo `syncCalendar` con el mismo import no revierte la corrección (test). `--dry-run` no escribe.
- **CA-7 (evidencia, solo lectura contra prod)**: En el ledger, comando y salida de: (a) `historico:sync --dry-run --desde 2026-08-14 --hasta 2026-11-09`: los 19 de `ca9-vecinos.log` emparejados, sin emparejar = solo Rayo–Athletic (F-SPEC-070-2), ambiguos 0 o cada uno explicado, `ca9-check` adaptado a la ventana con `rival_distinto=0`, y la línea de Celta Fortuna–Córdoba con 70695028, 2-2 y sus goles; (b) `calendario:sync -- 2026-27 --dry-run --reales-desde 2026-08-14`: las 17 correcciones `FINISHED` de `ca9-vecinos.log` con su instante, ninguna para los 2 `POSTPONED` ni para Rayo–Athletic, y la lista de cualquier otra corrección.
- **CA-8 (regresión)**: Los tests de SPEC-070 (`explorer-emparejamiento`, `historico`, `explorer-xornada`, `explorer-enrichment`) y de SPEC-015 (`sync`, `cli`) siguen en verde; cualquier ajuste se justifica en el ledger. `npm run gates` → 0.

## Entidades y reglas afectadas
ADR-031 (nuevo), ADR-026, ADR-023 §4 (`horaTexto` y `estado` son de contrato), ADR-028 (cambios solo en `data/calendario/**` exentos de versión), SPEC-070 (identidad), SPEC-015 H-1, SPEC-060, D-3, N-2.

## Fuera de alcance
Ejecutar `historico:sync` en real o fusionar el back-fill del calendario (lo decide el titular tras CA-7). Ventana en el enriquecimiento web (`enrichMatchesWithGoals`): con el kickoff corregido y cargado, el día ya es el bueno. Mover a futuro el kickoff de un aplazado ya pasado (lo bloquea `isPast`; resto de F-SPEC-069-2). Rayo–Athletic. Cambiar explorer.

## Notas para el gate humano
- **Ventana ±3**: cubre los 19 (desfases de −2 a +1). Es segura porque en una liga el par (competición, local, visitante) es único por temporada: dos candidatas solo salen de un rejugado o de un duplicado de explorer.
- **Preferencia por `FINISHED`** entre varias candidatas: no relaja la identidad, solo elige entre filas del mismo partido. Resuelve Las Palmas–Eldense (F-SPEC-069-2).
- **Solo `FINISHED` corrige el calendario**: un aplazado no se lleva a su fecha frustrada; si se llevara, `isPast` impediría luego moverlo a la de rejugado.
- **Decidido por el titular (2026-11-10) — autofusión**: una corrección del kickoff de un partido ya jugado es una reprogramación pura; el bot la fusiona y la carga solo (SPEC-015 H-1).
- **Decidido por el titular (2026-11-10) — `horaTexto` de Tercera**: se copia tal cual, aunque sea una hora como 17:33 o 16:47 (Arteixo–Lalín, Estradense–Celta C).
- Coste: el bot pide ~15 días de export a explorer por ejecución (explorer lee su base, no la RFEF).
