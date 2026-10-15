# Lectura de campo — jornada 2026-10-09/12 (solo lectura)

Ventana desde los datos (`01-ventana`, `05-hasta`): primer kickoff **2026-10-09T19:00:00Z** (malaga-espanyol), último final **2026-10-12T21:03:50.522Z** (RN-12 de levante-sevilla). 49 partidos, cinco competiciones (10/10/11/9/9). Para la prórroga se lee hasta último kickoff + 360 = 2026-10-13T01:00Z.
Todas las consultas: `begin read only` + `set local statement_timeout = '30s'` (`q.mjs`). 0 escrituras, 0 peticiones al proveedor, 0 ficheros del repo tocados.

## 1. SPEC-018 CA-8 / F-SPEC-018-2
- Consulta literal del ledger (`10-ca8-ledger.sql`): solo-prórroga = 2 tandas horarias: 21Z 6 intentos/6 peticiones, 22Z 3/3 → **9 peticiones** (cota inferior).
- Único partido en prórroga: `tercera-rfef-g1-j6-pontevedra-b-portonovo` (KO 18:00Z, `sen_sinal` RN-05 desde 18:15Z, `finished 0-1` RN-01 a 22:10:34Z = +250 min). Observaciones desde +150 (`12-prorroga-obs`): **20 sondeos** a 300–325 s, cada uno con su observación → la prórroga completa costó **20 peticiones ≤ 42**.
- F-SPEC-018-2: **no se dio**. Los 9 intentos solo-prórroga tienen `observations=1`; ningún hueco de 30 s en la prórroga; los 7 fallidos de la jornada (5xx del proveedor, 10-10 y 10-11 por la mañana) caen fuera de la prórroga (`15-fallidos`).
- Veredicto: **cumple** (muestra: 1 partido rezagado).

## 2. SPEC-017 `--contrastar` (CA-1/CA-2)
- Código: `tools/informe-jornada.mjs` → `contrastarMarcadores` (`src/ingest/contraste.ts`) → `apiFootballByIds` (`IDS_PER_REQUEST = 20`). Si hay un contraste guardado con la etiqueta `contraste-<desde>-<hasta>-<temporada>`, relee (0 peticiones); si no, pide ⌈n/20⌉ por temporada.
- `storage.objects` con `%contraste-%`: **0 objetos** (`20-contrastes-guardados`). 49 partidos, los 49 con alias, una temporada → **3 peticiones** (20 + 20 + 9) en la primera ejecución, más un `put` al raw store. La segunda ejecución con la **misma** `desde`/`hasta` releería: 0.
- **No ejecutado.** Decide el titular.
- Informe sin `--contrastar` generado (exit 0): `30-informe-ventana-datos.md` (19:00Z→21:03:50Z) y `31-informe-ventana-N1.md` (18:50Z→21:30Z, N-1). Con N-1: ticks 3892/3899 (100 %), 5042 peticiones, pico 4/min, cumple N-4, 0 alertas `unresolved_team`/`conflict`, 6 `forced_finish`, «sin directo y sin final: 0», veredicto `sin veredicto` (falta contraste).
- Veredicto: **no se puede leer** sin la decisión del titular.

## 3. F-SPEC-013-6 (RN-12 tras el cierre forzoso)
- Consulta de CA-5 por partido (`40-`, `41-rn12-*.sql`), alertas `forced_finish` abiertas entre 2026-10-09T19:00Z y 2026-10-13T01:00Z.
- **6 de 6** con RN-12 en ≤ 30 min, **mediana 98 s, máximo 224 s** (levante-sevilla). barcelona-getafe 14 s, ponferradina-aviles 90 s, sarriana-arenteiro 95 s, lugo-logrones 101 s, betis-osasuna 187 s (forzoso 4-2 → RN-12 5-2), levante-sevilla 224 s. 6 RN-12 en la jornada = 6 Decisions `forced_finish`.
- Acumulado con la anterior: 14 de 14, máximo 1186 s.
- Veredicto: **cumple**, no hace falta subir `WINDOW_AFTER_MINUTES`.

## 4. R-SPEC-009-1 (Primera produce Decisions)
- `50-primera.sql`: 10 partidos de `primera-division`, **10 con Decisions (980 en total)** y 2.430 observaciones. Estado final: 9 `finished` (6 RN-01 `provisional`, 3 RN-12 `confirmado`: barcelona-getafe, betis-osasuna y levante-sevilla) y 1 `suspended` (rayo-vallecano-athletic-club, 0-0, RN-01 a 12:54Z, dado por la fuente).
- Veredicto: **cumple**.

## Observaciones fuera de alcance
- rayo-athletic: el proveedor alterna `suspended`/`live` desde 12:30Z (`53-rayo-mezcla`). La Decision `suspended` no llega hasta 12:54Z.
- antela-barco y celtiga-alondras: dos RN-05 `sen_sinal` seguidas (v2 decidida a 15:45:06.353Z, v3 a 15:45:04.084Z). Los `decided_at` no son monótonos con la versión: hubo dos caminos concurrentes y solo uno tiene `ingest_attempt` (`60-`, `61-`).
- La línea de salvedad del informe sigue imprimiendo «su comprobación queda como R-SPEC-009-1» aunque hayan jugado las cinco competiciones.
