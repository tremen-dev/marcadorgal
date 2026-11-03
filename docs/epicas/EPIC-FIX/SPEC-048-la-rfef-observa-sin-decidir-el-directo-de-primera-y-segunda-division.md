---
id: SPEC-048
tipo: spec
epica: EPIC-FIX
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-03, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-03, por: Alberto Fojo}
---
# SPEC-048 — La rfef observa sin decidir el directo de Primera y Segunda División

## Problema
**Daño (2026-11-02).** `primera-division-2026-27-j11-deportivo-osasuna` (real 2-1) se publicó `finished` 0-0: 215 observaciones rfef `live` 0-0 sin un cambio y cierre forzoso de RN-02; API-Football 0/359 (plan gratuito, y así seguirá). Explorer apunta (certeza media) a que la RFEF no lleva el directo de Primera y Segunda; las tres RFEF sí. **Decisión del titular (2026-11-03):** mitigación desplegada **antes del 2026-11-07**: la rfef no publica marcador en directo en Primera y Segunda hasta confirmar la causa. Ejecuta **ADR-027**. SPEC-046 / ADR-026 es el remedio de fondo y no bloquea esta.

## Usuarios / roles afectados
- Público: en Primera y Segunda ve «por xogar · sen sinal» durante el partido y el final cuando llega el acta; nunca un 0-0 congelado como final.
- Titular: revierte con una línea del registro cuando se confirme la causa.

## Criterios de aceptación
- **CA-1 Registro.** `SourceConfig` gana `liveObservedOnly?: CompetitionId[]` (ADR-027 §1). Tests en `src/model/`: un valor fuera de `competitions` → error al parsear; ausente → `[]`. `src/sources/registry.ts`: la rfef con `["primera-division", "segunda-division"]`; api-football sin el campo (test que lo fija).
- **CA-2 Filtro puro.** Función pura en `src/ingest/` (sin reloj, red ni base) que, dado el registro y la competición, quita a las observaciones lo que ADR-027 §1 excluye. Tests: rfef `live` en `primera-division` y en `segunda-division` → fuera; rfef `finished`, `scheduled`, `postponed`, `suspended` en `primera-division` → dentro; rfef `live` en `primera-rfef-g1` → dentro; api-football `live` en `primera-division` → dentro; `operator` siempre dentro.
- **CA-3 Motor de punta a punta (test db).** Partido de `primera-division`, Decision vigente `scheduled`; una observación rfef `live` 0-0 cada 30 s desde kickoff + 2. Ticks del motor a kickoff + 15, + 120 y + 150: (i) a + 15 → `scheduled · sen_sinal`, RN-05; (ii) ninguna Decision `live` ni `finished` en todo el tramo, ni alerta `forced_finish`; (iii) todas las observaciones rfef están en `observations`; (iv) luego una rfef `finished` 2-1 → `finished · provisional`, RN-01. Control: la misma secuencia en `primera-rfef-g1` da `live` y cierre forzoso como hoy. Reversibilidad: con `liveObservedOnly` vacío, la secuencia de Primera reproduce el comportamiento de hoy (`live` 0-0 → `finished` RN-02).
- **CA-4 Todas las entradas al motor.** El filtro se aplica también en el motor a la hora de la observación (ADR-025 §4, `rfef:recuperar`) y en `replay-jornada`. Tests: recuperación de un partido de Primera con observaciones rfef `live` y `finished` → solo cuenta el `finished`; `replayJornada` sobre ese partido no produce ninguna Decision `live` ni una corrección con el marcador de un `live` excluido.
- **CA-5 Los finales del acta valen (evidencia).** Consulta de producción, en el ledger: por cada partido de `primera-division` y `segunda-division` con observaciones rfef `finished` desde el alta de la rfef (SPEC-038), primer marcador `finished`, último y Decision vigente. Si algún primer `finished` difiere del último (un final rfef que se corrigió solo), la spec **para** y vuelve al titular antes de desplegar.
- **CA-6 Fronteras y gates.** `git diff --stat` solo en `src/model/source.ts`, `src/sources/registry.ts`, `src/ingest/` y tests; nada en `src/decide/`, `src/sources/rfef/` ni `supabase/`. `npm run gates` → 0; `npm run test:db` en verde.
- **CA-7 Desplegado y jornada.** (a) Despliegue de producción con el commit de la spec antes del primer kickoff del 2026-11-07 (id de despliegue y sha en el ledger). (b) Tras la jornada, consulta: Decisions `live` de partidos de Primera/Segunda del 2026-11-07 al 2026-11-09 que citen una observación rfef → 0; observaciones rfef `live` de esos partidos > 0 (se siguió observando). Una captura gl de un partido de Primera en juego con «sen sinal» en `_qa/SPEC-048/`.

## Entidades y reglas afectadas
Fuente, Observation, Decision, Cualificador, Ventana (`dominio.md`); RN-01, RN-02, RN-05, RN-12 sin cambio de letra; **ADR-027**, ADR-003, ADR-013 §2, ADR-023, ADR-025 §4; D-5, D-7.

## Fuera de alcance
- Cualquier cambio en el motor, el adaptador, explorer, la pantalla o el esquema. Cobertura por competición en el adaptador, live contradicho, cierre `sen_sinal` y herramienta de operador: SPEC-046.
- Revertir: es un cambio de una línea en el registro que pide su propia evidencia (ver H-4).

## Notas para el gate humano
- **H-1 Opción elegida: observar sin decidir (ADR-027).** Coste: un campo del registro, una función pura y tres llamadas en `src/ingest/` (≈ medio día con tests); se guardan las observaciones y entran los finales. *Quitar Primera/Segunda del registro de la rfef*: una línea, pero el tick deja de pedirlas, se pierden los finales del acta (`scheduled · sen_sinal` sin final) y la medida de SPEC-039. Si el plazo aprieta, esa es la caída de emergencia.
- **H-2 Los finales siguen valiendo.** El acta fue buena en lo medido (SPEC-044: Oviedo 2-3, Valladolid 4-3); no consta un `FINISHED` rfef con el marcador congelado, pero no está probado que no pueda darse. Riesgo residual: un `FINISHED` con el marcador congelado se publicaría `finished · provisional`, y RN-12 no lo corrige (no es cierre forzoso). CA-5 lo mira con datos antes de desplegar. ¿Aceptado?
- **H-3 SPEC-046 / ADR-026.** Esta spec resuelve de forma temporal H-1 de SPEC-046 con otro mecanismo. Propuesta: antes del gate de SPEC-046, su CA-2 y ADR-026 §1 pasan a usar `liveObservedOnly` (la observación se guarda) en vez de `RFEF_LIVE_COMPETITIONS`; sus §2-§3 y la herramienta de operador siguen siendo necesarios para las RFEF y para el residual de H-2.
- **H-4 SPEC-039 y la reversión.** La jornada del 2026-11-07/08 sigue midiendo: las observaciones rfef `live` de Primera/Segunda se guardan (desfase por gol solo si API-Football hablara; dígitos falsos sí). Su cobertura (c) y sus `conflict`/RN-03 en Primera/Segunda serán 0 por diseño: anotarlo en su informe. Revertir cuando un export muestre a la RFEF moviendo marcadores de Primera/Segunda en directo en ≥ 1 jornada, con decisión del titular en el ledger de esta spec.
- **H-5 Número de ADR.** ADR-027 se toma porque ADR-026 está en la rama de SPEC-046; si otra sesión lo usó, se renumera al fusionar.
