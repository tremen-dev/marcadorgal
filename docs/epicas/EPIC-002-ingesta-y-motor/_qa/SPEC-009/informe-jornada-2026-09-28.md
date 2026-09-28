# Informe de la jornada · 2026-09-25 → 2026-09-28

Se midieron cuatro de las cinco competiciones de D-3: Primeira Federación · Grupo 1 (10 partidos), Segunda División (11 partidos), Segunda Federación · Grupo 1 (9 partidos), Terceira Federación · Grupo 1 (9 partidos).
Sin partidos en la ventana: primera-division.

## 1. Ventana y cobertura
ventana: 2026-09-25T18:20:00.000Z → 2026-09-28T21:00:00.000Z (74.7 h)
partidos en la ventana: 39
ticks: 2727 de 2731 esperados (100 %)   ← cobertura de CA-9
  cobertura sobre la ventana efectiva de cada partido: de kickoff − 10 min al
  cierre de su Decision finished (forzado en kickoff + 120 min, RN-02), no a kickoff + 150 min.
intentos dentro de la ventana de ADR-002 §2 pero tras el cierre de todo partido: 6
horas de ventana sin ejecuciones: 0
intentos fuera de la ventana de todo partido: 0   ← criterio 2
intentos fallidos: 0

## 2. Cadencia efectiva
Huecos entre observed_at consecutivos de cada partido, más el que va de su última
observación al cierre de su ventana: el coste de muestrear a 30 s, y lo que delata
un job caído, que deja de dejar observaciones.
mediana: 30.0 s (n=9298) · p95: 32.8 s (n=9298) · máximo: 82397.5 s (n=9298)
huecos > 90 s: 2
  2026-09-26T16:30:06.208Z  300.2 s  primera-rfef-g1-2026-27-j5-lugo-racing-ferrol  Primeira Federación · Grupo 1
  2026-09-26T16:57:06.411Z  82397.5 s  tercera-rfef-g1-2026-27-j4-antela-somozas  Terceira Federación · Grupo 1

## 3. Latencia interna
decided_at − observed_at de la observación citada que trae el marcador nuevo. Advertencia
(N-10): es cero por construcción —`observed_at` y `decided_at` salen del mismo reloj
inyectado por ruta (ADR-008 §7)— y **no mide** tiempo de proceso; las muestras no nulas
son la antigüedad de la observación citada por RN-02. No es latencia extremo a extremo.
La primera Decision con marcador de cada partido —el 0-0 del estreno— cuenta
como cambio: la muestra lleva un estreno por partido además de los goles.
mediana: 0.0 s (n=132) · p95: 0.0 s (n=132) · máximo: 11.8 s (n=132)
techo propio = p95(a), el p95 de cadencia, sin sumar (b): 32.8 s

## 4. Latencia extremo a extremo
decided_at − instante de la referencia externa, una fila por gol referenciado
a mano en referencias.csv (H-6 (ii)).
mediana: 53.2 s (n=15) · peor caso (n=15): 2278.2 s (n=15) · máximo: 2278.2 s (n=15)
rango: [-94.8 s, 2278.2 s]
objetivo de vision.md: mediana < 45 s → NO cumple · el p95 de vision.md no se contrasta con n=15
tamaño esperable: los 39 partidos de la ventana dan del orden de 98 goles, pero la muestra
la limita lo que una persona puede seguir a la vez (H-3: domingo 27, 14:00Z-17:00Z),
así que pesa menos que la cadencia (a), que se calcula sobre miles de capturas.
referencias no casadas: 9
  primera-rfef-g1-2026-27-j5-mirandes-unionistas,1-0,2026-09-27T14:42:29.000Z,radio-galega  →  el marcador 1-0 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,0-1,2026-09-27T15:06:00.000Z,radio-galega  →  el marcador 0-1 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,0-2,2026-09-27T15:39:00.000Z,radio-galega  →  el marcador 0-2 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,1-2,2026-09-27T15:43:00.000Z,radio-galega  →  el marcador 1-2 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,2-2,2026-09-27T16:16:00.000Z,radio-galega  →  el marcador 2-2 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,2-3,2026-09-27T16:23:00.000Z,radio-galega  →  el marcador 2-3 nunca se publicó
  segunda-rfef-g1-2026-27-j4-arosa-alaves-b,2-4,2026-09-27T16:26:00.000Z,radio-galega  →  el marcador 2-4 nunca se publicó
  tercera-rfef-g1-2026-27-j4-boiro-villalbes,1-0,2026-09-27T16:27:00.000Z,radio-galega  →  el marcador 1-0 nunca se publicó
  tercera-rfef-g1-2026-27-j4-portonovo-silva,2-0,2026-09-27T16:48:00.000Z,radio-galega  →  el marcador 2-0 nunca se publicó

## 5. Peticiones al proveedor
De ingest_attempts.details->>'requests' y no de net._http_response, que pg_net
poda a las pocas horas y no sobrevive a una medición de cuatro días (N-2).
total: 3414 peticiones en 2733 intento(s)
por día: 2026-09-25 247 · 2026-09-26 1061 · 2026-09-27 1852 · 2026-09-28 254
pico por minuto: 4 (2026-09-26T11:50Z)
presupuesto SPEC-005 N-4 (≤ 6/min, ~3000/día): cumple

## 6. Partidos sin señal
RN-05 y RN-02: un partido sin señal es el motor haciendo su trabajo, no un defecto.
El hueco de cada uno incluye el que va de su última observación al cierre de su
ventana: así se ve un tick que murió a mitad de partido, no solo uno que saltó turnos.
sin ninguna observación: 0
con al menos un hueco > 15 min: 1
  tercera-rfef-g1-2026-27-j4-antela-somozas · Terceira Federación · Grupo 1 · hueco mayor: 82397.5 s

## 7. Alertas
Ninguna se resuelve aquí (EPIC-004); cada una lleva su explicación a mano debajo.
abiertas en la ventana: 17
  por kind: forced_finish: 9 · regression: 8
  2026-09-25T19:46:06.084Z  regression  segunda-division-2026-27-j7-girona-albacete  {"current":{"away":1,"home":2},"proposed":{"away":0,"home":2},"sourceId":"api-football","observationId":"7278a59b-84c2-41cf-8724-d9acf25ddef1"}
    explicación: gol fantasma de la fuente (2-1) durante 2 observaciones; volvió a 2-0 y lo confirmó 74 veces. 2-0 era el resultado real (crónica de prensa). RN-03 retuvo el 2-1 y cerró así: es la primera discrepancia del bloque 8. Hallazgo 2.
  2026-09-26T13:20:30.979Z  regression  segunda-division-2026-27-j7-ceuta-real-sociedad-b  {"current":{"away":1,"home":1},"proposed":{"away":1,"home":0},"sourceId":"api-football","observationId":"5812c1e1-38be-488c-b114-ea279399dd97"}
    explicación: dos causas en el mismo partido: esta regresión, y un cierre forzoso a kickoff+120 con 2-1 cuando la fuente acabó dando 3-1. Hallazgos 2 y 3.
  … y 15 más, explicadas por kind
explicación de las 15 restantes, por kind (F-SPEC-009-4):
  regression (6 más): la fuente publica un marcador, se retracta, y RN-03 mantiene el
    vigente porque «un marcador no baja salvo por el operador», que es EPIC-004. De las 8,
    6 acabaron con el marcador final equivocado y 2 acertaron. El número de confirmaciones
    NO separa unas de otras (3 a 87 en ambos grupos). Detalle y propuesta: hallazgo 2.
  forced_finish (9): la fuente deja el partido clavado en el minuto 90 en `live` y no manda
    el final dentro de kickoff + 120 min; RN-02 cierra, que es lo que debe hacer. Las nueve
    tienen `minute: 90` y `lastStatus: live`. Una de ellas (merida-logrones) congeló un 3-4
    que la fuente acabó dando 3-5: es la única discrepancia que no viene de RN-03. Hallazgo 3.
unresolved_team y conflict se esperaban en cero: unresolved_team 0, conflict 0.

Lo que este informe no ve, medido aparte: `hallazgos-jornada.md` (cobertura de la
fuente en Terceira, RN-03, cierres forzosos, calendario desfasado y latencia).

## 8. Contraste de marcadores
Una sola tanda de peticiones por ids=, al terminar la jornada y fuera de
ventana (RN-08), anotadas aparte de las del tick.
32 de 39 partidos con `finished` y marcador coincidente.
peticiones del contraste: 2 (aparte de las del tick)
coinciden:
  primera-rfef-g1-2026-27-j5-extremadura-zamora  finished 0-1
  segunda-division-2026-27-j7-granada-andorra  finished 2-3
  primera-rfef-g1-2026-27-j5-cultural-leonesa-coria  finished 2-2
  segunda-rfef-g1-2026-27-j4-amorebieta-ourense-cf  finished 0-1
  tercera-rfef-g1-2026-27-j4-atletico-arteixo-alondras  finished 2-4
  … y 27 más
aplazamientos que el proveedor confirma: 0
estados no-finished que el proveedor confirma: 0
partidos sin respuesta del proveedor: 0
discrepancias: 7
  segunda-division-2026-27-j7-girona-albacete  board: finished 2-1  ·  proveedor: finished 2-0  ·  raw_ref: raw/api-football/2026-09-25/2026-09-25T20-23-06.436Z-974c0848-8a5d-44b8-81e1-41d7ef889fd2.json.gz
  segunda-division-2026-27-j7-ceuta-real-sociedad-b  board: finished 2-1  ·  proveedor: finished 3-1  ·  raw_ref: raw/api-football/2026-09-26/2026-09-26T14-00-03.308Z-802ceda9-7e1e-4d9f-9153-199d9e4491fa.json.gz
  primera-rfef-g1-2026-27-j5-lugo-racing-ferrol  board: finished 1-1  ·  proveedor: finished 1-0  ·  raw_ref: raw/api-football/2026-09-26/2026-09-26T16-37-06.414Z-826374c0-8b21-40b6-823d-cf489a398469.json.gz
  segunda-division-2026-27-j7-celta-fortuna-sabadell  board: finished 1-2  ·  proveedor: finished 1-1  ·  raw_ref: raw/api-football/2026-09-26/2026-09-26T18-22-43.746Z-c05ebae3-7c97-48e7-8de2-566a074fad55.json.gz
  primera-rfef-g1-2026-27-j5-mirandes-unionistas  board: finished 0-1  ·  proveedor: finished 1-0  ·  raw_ref: raw/api-football/2026-09-27/2026-09-27T15-59-54.618Z-c5207771-abc8-4e32-bd10-2119b82aeb5a.json.gz
  primera-rfef-g1-2026-27-j5-merida-logrones  board: finished 3-4  ·  proveedor: finished 3-5  ·  raw_ref: raw/api-football/2026-09-27/2026-09-27T18-15-02.183Z-0ca257a8-aa66-4de9-861c-0145100be38b.json.gz
  segunda-division-2026-27-j7-burgos-eldense  board: finished 0-1  ·  proveedor: finished 1-0  ·  raw_ref: raw/api-football/2026-09-27/2026-09-27T18-20-02.122Z-0de60db3-719c-4cf7-8363-a197e085a6b3.json.gz

## 9. Veredicto
veredicto: no válida (c2)
  - 7 partido(s) con marcador que no cuadra con el proveedor, sobre una ingesta con 9331 observaciones
  rama (c2) ingesta sana y motor equivocado: no se repite. El crudo vive 30 días
  (ADR-007 §5) y src/decide/replay.ts es determinista: se corrige el motor, se recalcula
  el log de Decisions sobre las observaciones guardadas y el informe se rehace con los
  números del replay, anotando que la latencia interna se midió sobre la original.
salvedad de H-1: criterio 5 cerrado sobre cuatro competiciones de cinco; primera-division no jugó en la ventana; su comprobación queda como R-SPEC-009-1.
declaraciones pendientes (no se derivan de la base de datos): 3
  - intervención sobre el dato (H-2 (i)): invalida el criterio 5
  - intervención sobre la plataforma (H-2 (ii)): baja a válida con reservas
  - explicación a mano de cada alerta abierta (CA-4 (c)): sin ella no hay válida
