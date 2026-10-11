---
id: SPEC-032
tipo: spec
epica: EPIC-004
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-11, por: Alberto Fojo}
---
# SPEC-032 — Calibración de la cadencia sostenible de la RFEF con una identidad estable

## Problema
La RFEF bloquea por IP tras unas 5 vueltas de 3-6 peticiones cada 2 min
(F-SPEC-031-9). Ese ritmo lo pisamos, no lo medimos: no sabemos qué cadencia
aguanta un consumo mínimo (ADR-019: una petición por vuelta, sesión reutilizada).
Sin ese número, ni el alta ni el criterio 3 de la épica (mediana < 45 s) se pueden
decidir. Esta spec construye la herramienta, corre **una** serie y deja el
número y la recomendación al titular. No da de alta nada.

## Usuarios / roles afectados
- Titular: corre la serie (o la autoriza) y decide con el informe (tabla de decisión).
- Espectador: nada.

## Criterios de aceptación
- **CA-1 Plan en seco.** `npm run rfef:calibrar -- --dry-run` imprime los
  escalones (180, 120, 90, 60, 45 y 30 s), la permanencia de cada uno, las
  peticiones máximas (~175) y la duración máxima (~3 h). Con un `fetch` doble,
  0 llamadas.
- **CA-2 Patrón de producción (ADR-019 §1-§2).** Con `fetch` doble y reloj
  falso: la vuelta 1 hace un GET a la portada y un POST `todos`. Las siguientes
  hacen **un** POST `Sch_en_juego=1` con la misma cookie. La última (fin de plan)
  hace un POST `todos`. Ante un 3xx o un cuerpo `NLogin`, hace un GET a la
  portada y **un** reintento; un segundo `NLogin` para la serie. URL, cuerpo,
  `Content-Type`, `redirect: "manual"` y UA salen de las mismas constantes que
  `src/sources/rfef/adapter.ts` (un test compara). Nunca más de 3 peticiones
  por vuelta.
- **CA-3 Escalones y permanencia.** Con reloj falso, los inicios de petición
  salen separados exactamente por el intervalo del escalón (nunca antes). Cada
  escalón dura `max(30 min, 10 peticiones)` antes de bajar al siguiente. Una
  petición lenta no adelanta la siguiente. Duración total ≤ 4 h.
- **CA-4 Parada al primer vacío.** Ante el primer `200` con cuerpo vacío
  (fixture real `…-todos-vacio.raw`), la herramienta hace **0** peticiones más,
  registra el umbral y sale con código ≠ 0. También para, sin reintentar, ante
  un no-2xx, un error de red o un segundo `NLogin`. Una respuesta rancia
  (sha-256 igual a la anterior, ADR-018 §4) se registra y **no** para la serie.
- **CA-5 IP libre sin provocar bloqueo.** La herramienta no hace ninguna
  petición (test con `fetch` doble) si: (i) no se le pasa
  `--ultima-peticion <ISO>` (última petición conocida a `marcadores.rfef.es`
  desde esa IP, incluida la navegación a mano); (ii) esa fecha o la última línea
  de `_qa/calibracion/*.jsonl` tienen menos de **24 h**; (iii) no hay al menos un
  partido de las cinco competiciones en ventana (ADR-002 §2) según
  `data/calendario/`. No hay sondeo aparte: la primera petición de la serie hace
  de sondeo. Si vuelve vacía, se registra `bloqueada-al-inicio`, la serie acaba
  y la regla (ii) impide reintentar antes de 24 h.
- **CA-6 Registro sin secretos.** Una línea JSONL por petición en
  `docs/epicas/EPIC-004-fuente-rfef/_qa/calibracion/<fecha>.jsonl`: inicio (ISO
  Z), escalón, nº en escalón y total, variante, método, status, `Content-Length`,
  bytes, sha-256, `Date` del servidor, y filas y `requestErrors` de `parse`
  (SPEC-031). Los cuerpos van en `.raw.gz` a `--crudo <dir>`, fuera del repo.
  La cookie no aparece en el JSONL ni en la consola (test).
- **CA-7 Informe y recomendación (función pura).** A partir del JSONL se genera
  `_qa/calibracion/<fecha>-informe.md` con: umbral (escalón, peticiones en ese
  escalón y peticiones en los 10, 30 y 60 min previos al vacío), o «sin umbral
  hasta 30 s»; **sostenible** = el escalón más rápido completado sin vacío;
  **recomendada** = un escalón más lento que la sostenible (si se sostiene 30 s,
  la recomendada es 45 s); si no se completa ninguno, «sin cadencia sostenible».
  Debajo va la tabla de decisión de las notas, con la fila que corresponde
  marcada. Test sobre JSONL fijos: un caso por fila de la tabla, más
  `bloqueada-al-inicio`.
- **CA-8 Serie real.** Una serie corrida en una franja con partidos y con los
  JSONL e informe en `_qa/calibracion/`. El ledger cita el comando, la
  `--ultima-peticion` declarada y la cadencia recomendada. Si la serie acaba en
  `bloqueada-al-inicio`, el CA sigue abierto y se repite otro día de partido.
- **CA-9 Fronteras y gates.** La lógica (plan, parada, informe) es pura en
  `src/sources/rfef/calibration.ts`: sin reloj, red ni `fs`, y solo importa de
  `src/model` y de `src/sources/rfef`. La cáscara es `tools/calibrar-rfef.mjs`.
  Sin cambios en `registry.ts` ni en `ADAPTERS`. Sin dependencias nuevas.
  `npm run gates` → 0.

## Entidades y reglas afectadas
Source, Raw capture (`dominio.md`); RN-01, RN-08; D-5, D-7; ADR-002 §2,
ADR-013, ADR-017, ADR-018, **ADR-019** (borrador).

## Fuera de alcance
- Alta, registro, almacén de sesión, backoff en el tick e IP estática de Vercel:
  spec de alta (ADR-019 §1, §4-§6).
- La ficha (minuto, F-SPEC-031-2). Si interesa, se mide aparte con la cadencia
  ya conocida.
- **Rotación o renovación de IP, proxies, varios orígenes o cualquier técnica
  para no ser identificados o eludir el bloqueo** (ADR-019 §7). Si la serie
  falla, no se reintenta con otra IP.

## Notas para el gate humano
**Tabla de decisión** (sobre la cadencia recomendada C\*; la decide el titular).
El retraso medio de detección es ~C\*/2, más la publicación de la RFEF (sin medir):
| C\* | Opción |
|---|---|
| ≤ 45 s | Directo en las franjas de H-2; la latencia se comprueba en la jornada medida |
| 60 s – 3 min | Solo `sen sinal` y corrección de finales (H-2 b); criterio 3 no se cumple para la RFEF |
| sin cadencia | No hay alta por esta vía; solo acceso autorizado |

- **H-1 Reabrir la vía.** `_epica.md` (Riesgos) dejó el alta a la espera de un
  acceso autorizado. Esta spec abre en paralelo una vía de consumo mínimo. Si se
  acepta, sdd-producto enmienda los Riesgos.
- **H-2 Alcance** (ADR-019 §3): (a) todas las franjas o (b) solo `sen sinal` más
  el cierre. Recomiendo decidirlo con el informe. Con C\* ≥ 60 s, (b) es forzosa.
- **H-3 Desde dónde se calibra.** Desde la IP del titular (la ya bloqueada,
  tras 24 h de reposo), o esperar a la IP estática de Vercel. La IP de un
  centro de datos puede tener otro umbral. Recomiendo la local ahora y que la
  spec de alta arranque en producción con C\* y con backoff, como confirmación.
- **H-4 Parámetros:** escalones, permanencia `max(30 min, 10)`, margen de un
  escalón y 24 h de reposo. Durante la serie, nadie navega la RFEF desde esa IP.
- **H-5** Aprobar ADR-019 (supersede solo ADR-018 §1).

**Resuelto por el titular (Alberto Fojo, 2026-10-11):** H-1 sí, la vía de
consumo mínimo se abre en paralelo al acceso autorizado; H-2 se decide con el
informe de la calibración (C\* ≤ 45 s → todas las franjas; ≥ 60 s → solo
`sen sinal` + cierre); H-3 desde este Mac tras 24 h de reposo, confirmación en
producción con la IP estática al dar de alta; H-4 parámetros tal cual; H-5
ADR-019 aprobado.
