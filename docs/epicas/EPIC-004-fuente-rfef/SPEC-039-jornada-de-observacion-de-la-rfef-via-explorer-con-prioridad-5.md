---
id: SPEC-039
tipo: spec
epica: EPIC-004
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-01, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-01, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-03, por: sdd-arquitecto — refinamiento de CA-1 b/c y CA-2 y CA-4 por F-SPEC-039-6 y F-SPEC-039-7 (H-5)}
---
# SPEC-039 — Jornada de observación de la rfef vía explorer con prioridad 5

## Problema
ADR-023 §1 deja la rfef en prioridad 5 hasta observar al proveedor. Sin una
jornada medida no hay con qué decidir si sube a 50 por competición: cuánto
tarda explorer respecto a API-Football, cuánto directo da donde API-Football
calla (objetivo de la épica), cuánto lo bloquea la RFEF y si algún dígito no
cuadra con el acta cerrada. Esta spec construye la medida, corre **una**
jornada completa de las cinco competiciones con la rfef dada de alta
(SPEC-038) y deja el informe y la recomendación al titular. No cambia la
prioridad: lo hará un ADR posterior con sus criterios (CA-4).

## Usuarios / roles afectados
- Titular: lee el informe y decide por competición. Operador: ve alertas `conflict`/RN-03 durante la jornada y no interviene salvo fallo real.
- Espectador: nada nuevo respecto a SPEC-038.

## Criterios de aceptación
- **CA-1 Informe rfef (función pura).** `npm run informe:rfef -- <desde> <hasta>`
  genera `_qa/SPEC-039/<fecha>-informe.md` desde `src/ingest/informe-rfef.ts`
  (puro: sin reloj, red ni `fs`; la cáscara en `tools/`), con tests sobre
  fixtures de filas de `observations`, `decisions`, `alerts` e
  `ingest_attempts`. Por competición: (a) partidos, observaciones `rfef` y
  `api-football`; (b) **desfase por gol**: para cada cambio de marcador que
  vieron las dos fuentes, Δ = `recorded_at` de la primera observación rfef con
  ese marcador − `recorded_at` de la primera de API-Football (segundo reloj,
  ADR-016), con mediana, p95 y n; sin observaciones de API-Football en la
  competición dice `sin datos`, no n=0; (c) **cobertura**: partidos con `live`
  `provisional` de rfef mientras API-Football no daba directo (`sen_sinal` o
  `scheduled` con kickoff pasado) y minutos cubiertos, en dos cifras:
  *observado* (desde `observations`) y *publicado* (Decision vigente `live`
  con `winner` rfef). Solo suman partidos con acta y sin `≠ acta en directo`
  (CA-2); los demás se listan aparte. Con rfef `live` observado > 0 y publicado
  0, la fila dice «la rfef observó sin decidir»: así se lee la competición con
  o sin `liveObservedOnly` (SPEC-048), sin leer el registro; (d) `conflict` y RN-03
  con la rfef como parte, con partido y duración; (e) intentos `rfef`
  `ok = false` por motivo y observaciones descartadas por `fueraDeVentana` o
  por `observedAt` futuro; (f) `strategy` y `discardedReadings` por fila del
  último export del día (fixture de la jornada).
- **CA-2 Contraste con acta cerrada.** Para cada partido `finished`: marcador
  del export del día siguiente (`FINISHED` = acta de la RFEF), último
  `finished` de API-Football y Decision vigente. Cuenta: coincidencias
  triples, discrepancias por fuente y **dígitos falsos**: observaciones rfef
  (`live` o `finished`) con un lado por encima del acta. 0 dígitos falsos es la
  condición de CA-4. **≠ acta en directo**: partidos con acta cuya última
  observación rfef `live` difiere del acta, haya o no `finished` de rfef; el
  apéndice da ese marcador, el acta y los minutos desde su último cambio (el
  0-0 congelado de Deportivo–Osasuna del 2026-11-02 sale aquí). Un partido sin
  acta al día siguiente queda `sin acta`; uno sin `finished` de API-Football,
  `sin api-football`: ninguno coincide ni discrepa por omisión, y si la
  competición no tiene `finished` de API-Football, «Triples» y
  «≠ api-football» dicen `sin datos`.
- **CA-3 Jornada real.** Una jornada completa (viernes a lunes) con las cinco
  competiciones, la rfef registrada con 5 (SPEC-038 CA-10) y **cero
  intervenciones manuales** por alias, parseo u ofuscación. Evidencia en
  `_qa/SPEC-039/`: el informe de CA-1, el de `informe:jornada --contrastar`
  (SPEC-017) con las alertas `conflict` atribuibles a la rfef explicadas en su
  texto (CA-9 de SPEC-017 las espera en cero), los exports del día y del día
  siguiente, y la **evidencia externa** de explorer al cierre: `/api/health`,
  sesiones abiertas, soft-blocks, segundos en cooldown dentro de la ventana de
  cada competición, sondeos saltados y anomalías (anotado en el ledger; explorer
  no es de este repo).
- **CA-4 Criterio de subida por competición.** El informe acaba con una tabla,
  una fila por competición, con estas condiciones y la recomendación `5` o `50`:
  (i) acta: sobre ≥ 6 partidos con acta y alguna observación rfef, 100 % de
  los `finished` de rfef iguales al acta, 0 dígitos falsos y 0 `≠ acta en
  directo`; (ii) desfase: mediana Δ ≤ 0 s y p95 Δ ≤ 45 s con n ≥ 5 goles
  (criterio 3 de la épica: con 50 la latencia pública es la de la rfef), y
  `sin datos` si (b) lo es;
  (iii) bloqueo: cooldown < 10 % del tiempo en ventana de esa competición y 0
  anomalías; (iv) ≥ 95 % de sus filas resueltas por estrategias estáticas; (v)
  0 intervenciones. `50` solo con las cinco en «sí»; si falla solo (ii), la
  fila dice «reserva útil, sin subir»; si (ii) es `sin datos` y las demás
  pasan, «5 — sin referencia de desfase»; ambas cuantifican el directo ganado
  de (c). La tabla es salida de la función pura (un test por condición y por
  cada `sin datos`). La decisión es del titular
  y se registra en un ADR que supersede ADR-023 §1 para esa competición.
- **CA-5 Una página y sin código de producto.** Informe ≤ 80 líneas antes del
  apéndice. El diff de la spec toca `src/ingest/informe-rfef*.ts`, `tools/` y
  `package.json`; nada en `src/sources/`, `src/decide/`, `registry.ts` ni
  `supabase/` (`git diff --stat`). `npm run gates` → 0.

## Entidades y reglas afectadas
Decision, Observation, Alert, Cualificador, Frescura (`dominio.md`); RN-01,
RN-03, RN-04, RN-05, RN-11; D-9; ADR-004, ADR-011, ADR-016, ADR-017 §5,
**ADR-023**; SPEC-017 (`--contrastar`), SPEC-025 (latencia), SPEC-038.

## Fuera de alcance
- Subir la prioridad (ADR posterior) y la spec del motor de ADR-017 §8.
- Medir la latencia gol → pantalla con la rfef al mando: con 5 no manda; se
  mide al subir, con `informe:latencia` (SPEC-025).
- Cambiar reglas de explorer (POST, intervalos, proxies): ADR-023 §2.

## Notas para el gate humano
- **H-1 Umbrales de CA-4.** Mediana Δ ≤ 0 y p95 ≤ 45 s es exigente: pide que la
  rfef no vaya por detrás de API-Football. Alternativa más laxa: mediana ≤ 15 s.
  Los ≥ 6 partidos y ≥ 5 goles evitan decidir con una muestra vacía (Tercera
  juega 9 por jornada; Primera puede no jugar). *Resuelta por el titular (Alberto Fojo, 2026-11-01):* umbral estricto (mediana Δ ≤ 0 s, p95 ≤ 45 s).
- **H-2 Alertas esperadas.** Con 5 y 10 adyacentes habrá `conflict` y RN-03 con
  la rfef (ADR-023 §1). Se aceptan como evidencia y se explican en el informe de
  SPEC-017; el operador no actúa sobre ellas. Si molestan, la alternativa es la
  spec del motor de ADR-017 §8.1 con bandas más finas, no silenciarlas. *Resuelta por el titular (2026-11-01):* se aceptan como evidencia.
- **H-3 Herramienta aparte.** `informe:rfef` nuevo en vez de ampliar
  `informe:jornada` (1.500 líneas con el veredicto de SPEC-017): la comparación
  entre fuentes es otra pregunta. `--contrastar` se reutiliza tal cual. *Resuelta por el titular (2026-11-01):* herramienta aparte.
- **H-4 Fecha.** Primer fin de semana con SPEC-038 en producción
  (propuesta: 2026-11-07/08). Si explorer entra en cooldown largo o cambia la
  ofuscación a mitad, la jornada vale igual: el informe lo cuenta. *Resuelta por el titular (2026-11-01):* 2026-11-07/08.
- **H-5 Refinamiento 2026-11-03 (F-SPEC-039-6/7), a ratificar.** API-Football
  seguirá sin datos: (ii) sale `sin datos` y esta jornada **no puede recomendar
  50** en ninguna competición; buscar otra referencia de desfase es otra spec.
  Un marcador congelado por debajo del acta ahora cuenta contra (i) y no como
  directo ganado; coste: un gol tras el último sondeo `live` también sale
  `≠ acta en directo` (el apéndice deja juzgarlo). Con SPEC-048, en Primera y
  Segunda (c) *publicado* y `conflict`/RN-03 saldrán 0 por diseño, y (i) mide
  igual con las observaciones guardadas.
