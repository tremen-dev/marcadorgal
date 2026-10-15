# Informe de la jornada · 2026-10-09 → 2026-10-12

Se midieron cinco de las cinco competiciones de D-3: Primeira División (10 partidos), Primeira Federación · Grupo 1 (10 partidos), Segunda División (11 partidos), Segunda Federación · Grupo 1 (9 partidos), Terceira Federación · Grupo 1 (9 partidos).
Sin partidos en la ventana: ninguna.

## 1. Ventana y cobertura
ventana: 2026-10-09T18:50:00.000Z → 2026-10-12T21:30:00.000Z (74.7 h)
partidos en la ventana: 49
ticks: 3892 de 3899 esperados (100 %)   ← cobertura de CA-9
  cobertura sobre la ventana efectiva de cada partido: de kickoff − 10 min al cierre de
  su Decision finished; si es la forzada (RN-02, kickoff + 120 min), a kickoff + 150 min; si sigue scheduled, prórroga hasta kickoff + 360 min a un tick cada 5 min.
intentos dentro de la ventana de ADR-002 §2 pero tras el cierre de todo partido: 6
horas de ventana sin ejecuciones: 0
pg_cron (cron.job_run_details): 8953 ejecuciones (succeeded 8953) · horas de ventana sin ninguna ejecución: 0
intentos fuera de la ventana de todo partido: 1   ← criterio 2
intentos fallidos: 7
  2026-10-10T13:01:03.656Z  api-football  api-football responded 500
  2026-10-10T14:02:06.131Z  api-football  api-football responded 500
  2026-10-10T14:12:06.198Z  api-football  api-football: 2 de 2 peticiones con error del proveedor: api-football returned errors: {"bug":"This is on our side, please report us this bug on https://dashboard.api-football.com","error":"5xEr"}
  2026-10-10T14:25:06.420Z  api-football  api-football responded 500
  2026-10-10T15:11:06.452Z  api-football  api-football: 1 de 2 peticiones con error del proveedor: api-football returned errors: {"bug":"This is on our side, please report us this bug on https://dashboard.api-football.com","error":"5xEr"}
  … y 2 más

## 2. Cadencia efectiva
Huecos entre observed_at consecutivos de cada partido, más el que va de su última
observación al cierre de su ventana: el coste de muestrear a 30 s, y lo que delata
un job caído, que deja de dejar observaciones.
mediana: 30.0 s (n=12543) · p95: 32.5 s (n=12543) · máximo: 325.1 s (n=12543)
huecos > 90 s: 20
  2026-10-10T20:29:58.444Z  300.4 s  tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo  Terceira Federación · Grupo 1
  2026-10-10T20:34:58.864Z  300.4 s  tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo  Terceira Federación · Grupo 1
  2026-10-10T20:39:59.314Z  300.5 s  tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo  Terceira Federación · Grupo 1
  2026-10-10T20:44:59.837Z  300.3 s  tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo  Terceira Federación · Grupo 1
  2026-10-10T20:50:00.096Z  301.2 s  tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo  Terceira Federación · Grupo 1
  … y 15 más

## 3. Latencia interna
decided_at − observed_at de la observación citada que trae el marcador nuevo. Advertencia
(N-10): es cero por construcción —`observed_at` y `decided_at` salen del mismo reloj
inyectado por ruta (ADR-008 §7)— y **no mide** tiempo de proceso; las muestras no nulas
son la antigüedad de la observación citada por RN-02. No es latencia extremo a extremo.
La primera Decision con marcador de cada partido —el 0-0 del estreno— cuenta
como cambio: la muestra lleva un estreno por partido además de los goles.
mediana: 0.0 s (n=215) · p95: 0.0 s (n=215) · máximo: 0.0 s (n=215)
techo propio = p95(a), el p95 de cadencia, sin sumar (b): 32.5 s

## 4. Latencia extremo a extremo
decided_at − instante de la referencia externa, una fila por gol referenciado
a mano en referencias.csv (H-6 (ii)).
(sin datos: ninguna fila de referencias.csv casó con una Decision)
tamaño esperable: los 49 partidos de la ventana dan del orden de 123 goles, pero la muestra
la limita lo que una persona puede seguir a la vez (H-3: domingo 27, 14:00Z-17:00Z),
así que pesa menos que la cadencia (a), que se calcula sobre miles de capturas.
referencias no casadas: 0

## 5. Peticiones al proveedor
De ingest_attempts.details->>'requests' y no de net._http_response, que pg_net
poda a las pocas horas y no sobrevive a una medición de cuatro días (N-2).
total: 5042 peticiones en 3899 intento(s)
por día: 2026-10-09 246 · 2026-10-10 1964 · 2026-10-11 1668 · 2026-10-12 1164
pico por minuto: 4 (2026-10-10T11:50Z)
presupuesto SPEC-005 N-4 (≤ 6/min, ~3000/día): cumple

## 6. Partidos sin señal
RN-05 y RN-02: un partido sin señal es el motor haciendo su trabajo, no un defecto.
El hueco de cada uno incluye el que va de su última observación al cierre de su
ventana: así se ve un tick que murió a mitad de partido, no solo uno que saltó turnos.
sin ninguna observación: 0
con al menos un hueco > 15 min: 0
sin ninguna observación en juego: 4 — segunda-rfef-g1-2026-27-j6-astorga-ourense-cf, tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo, tercera-rfef-g1-2026-27-j6-antela-barco, tercera-rfef-g1-2026-27-j6-celtiga-alondras
sin directo y sin final: 0

## 7. Alertas
Ninguna se resuelve aquí (EPIC-004); cada una lleva su explicación a mano debajo.
abiertas en la ventana: 6
  por kind: forced_finish: 6
  2026-10-10T18:30:06.985Z  forced_finish  primera-division-2026-27-j8-barcelona-getafe  {"score":{"away":0,"home":3},"minute":90,"kickoff":"2026-10-10T16:30:00.000Z","heldScore":{"away":0,"home":3},"lastStatus":"live","lastObservedAt":"2026-10-10T18:29:51.437Z"}
    explicación:
  2026-10-11T16:30:07.413Z  forced_finish  primera-rfef-g1-2026-27-j7-ponferradina-aviles  {"score":{"away":2,"home":0},"minute":90,"kickoff":"2026-10-11T14:30:00.000Z","heldScore":{"away":2,"home":0},"lastStatus":"live","lastObservedAt":"2026-10-11T16:29:36.693Z"}
    explicación:
  … y 4 más, explicadas por kind
unresolved_team y conflict se esperaban en cero: unresolved_team 0, conflict 0.

## 8. Contraste de marcadores
Una sola tanda de peticiones por ids=, al terminar la jornada y fuera de
ventana (RN-08), anotadas aparte de las del tick.
(sin datos: se generó el informe sin --contrastar)

## 9. Veredicto
veredicto: sin veredicto
  - falta el contraste de CA-5 (--contrastar): CA-9 (a) exige marcador coincidente y sin él no está medido
salvedad de H-1: criterio 5 cerrado sobre cinco competiciones de cinco; todas jugaron en la ventana; su comprobación queda como R-SPEC-009-1.
declaraciones pendientes (no se derivan de la base de datos): 3
  - intervención sobre el dato (H-2 (i)): invalida el criterio 5
  - intervención sobre la plataforma (H-2 (ii)): baja a válida con reservas
  - explicación a mano de cada alerta abierta (CA-4 (c)): sin ella no hay válida
