# Diagnóstico 2026-09-29 — R-SPEC-009-5 y F-SPEC-012-4

sdd-arquitecto, en solo lectura. Base `dev` con `default_transaction_read_only=on`
y `begin read only` (comprobado: `current_setting('transaction_read_only') = on`).
Ninguna petición al proveedor: lo que se sabe de él sale del PR #19, que abrió
hoy el workflow semanal. Ni ticks, ni Storage, ni código.

## 1. R-SPEC-009-5 — el calendario declarado llega tarde a la jornada

**Causa.** El proveedor publica cada jornada primero con una **hora de relleno**
(domingo 15:00Z en Segunda y Segunda RFEF, domingo 16:00Z en Primera RFEF y
Tercera) y con `status.short = NS`, no `TBD`. La hora real llega días después.
El sync corre **solo los martes**, así que todo cambio que llegue del miércoles
al sábado entra en base **después** de la jornada. No es zona horaria (los
desfases son de −44,5 h a +28 h, no de 1-2 h) ni fallo de `load` (`dev` = repo:
**0 discrepancias en 1.834 partidos**). `timeConfirmed` no lo ve: el importador
solo marca `TBD`/`PST`, y el sync del 22 (PR #13) dijo `unconfirmed: 0` en las
cinco competiciones con las horas de relleno dentro.

**No era un partido, eran cuatro.** El PR #19 de hoy trae los cambios que
llegaron tarde a la jornada medida:

| Partido | Declarado | Real (PR #19) | Efecto en base |
|---|---|---|---|
| tercera j4 antela-somozas | dom 16:00Z | sáb 16:00Z | 113 `live` descartados por N-5; 1 Decision `finished 1-0` el dom 16:00:06Z |
| tercera j4 sarriana-celta-c | dom 16:00Z | sáb 17:00Z | **0 `live`**; 20 obs, todas `finished`, dom 15:50-15:59Z |
| tercera j4 montaneros-viveiro | dom 16:00Z | dom 10:30Z | **0 `live`**; 20 obs, todas `finished`, dom 15:50-15:59Z |
| primera-rfef j5 extremadura-zamora | sáb 11:00Z | sáb 10:00Z | primer `live` a las 10:50:06Z: 50 min perdidos |

Los dos de 0 `live` están entre los **4 de 9** de Terceira que R-SPEC-009-3
atribuye a que «la fuente no cubre en directo». No se miraron mientras se
jugaban: la cobertura medida de Terceira está **subestimada** (2 de 9 sin
directo probados, no 4). Lo de antela se vio por suerte: a las 16:00Z del
sábado Terceira tenía otro partido en ventana y `live=` llevaba la liga 439.

**¿El tick lo observó?** Solo antela, y solo porque otra liga le abrió `live=`;
el motor lo tiró (N-5, `live` a más de 15 min del kickoff). La ventana de los
cuatro se abrió a la hora declarada, no a la real.

**Riesgo hoy — 2026-10-02/04: SÍ, 11 partidos.** Toda la J8 de Segunda está en
`dev` y en el repo a la hora de relleno (dom 04 15:00Z); el PR #19, sin fusionar,
trae la real:

| Partido | Real | Qué pasa si no se fusiona antes |
|---|---|---|
| eldense-oviedo | **vie 02 18:30Z** | invisible; `finished` el domingo 15:00Z |
| albacete-eibar, almeria-burgos, cadiz-leganes, sabadell-andorra | sáb 03 | igual que antela |
| cordoba-tenerife | **lun 05 18:30Z** | ventana del domingo con `NS`; se queda `scheduled` |
| real-sociedad-b-granada | dom 12:00Z (−3 h) | sin directo; `finished` a las 15:00Z |
| sporting-celta-fortuna | dom 14:15Z (−45 min) | pierde los primeros 35 min |
| castellon-ceuta, las-palmas-valladolid | dom 16:30Z (+1,5 h) | **RN-02 a las 17:00Z (declarado + 120) con el partido en el min ~30: marcador falso**, y la ventana cierra a las 17:30Z sin RN-12 |
| girona-mallorca | dom 19:00Z (+4 h) | ventana 14:50-17:30Z en `NS`; si `live=` lo trae después, cierre forzoso en su primer tick |

Esas alertas `forced_finish` falsas **contaminan CA-5 de SPEC-013**, que se mide
en esta jornada. Primera RFEF J6 (10) no cambia. **Sin saber** (hace falta el
proveedor): Tercera J5 (los 9 a dom 16:00Z, el patrón que movió 3 de 7 la
semana pasada) y Segunda RFEF J5 (4 a dom 15:00Z).

**2026-10-09/12: 16 cambios** en el PR #19 (11 de Segunda J9, 5 de Segunda RFEF
J6): mismos efectos si no se fusiona.

**Aviso del PR #19:** también reescribe el kickoff de los 4 partidos ya jugados.
Tras `load`, un informe o replay de 25-28 da números distintos de los del ledger.

Evidencia: `gh pr view 13|19 --json body`; `node cmp.mjs <desde> <hasta>`
(HEAD, `origin/chore/calendario-2026-09-29` y `matches` de `dev`) → «partidos en
[09-30, 10-06): 39; con cambio en PR #19: 11; discrepancias repo≠dev en toda la
temporada: 0»; recuento de observaciones por partido de Tercera J4 (`count(*)
filter (where status='live')`, `min/max(observed_at)`).

## 2. F-SPEC-012-4 — cierres duplicados: carrera real, daño latente, no EPIC-FIX

**Hipótesis matizada.** No son el hook y el barrido **del mismo tick**: esos
corren en serie y el barrido ve lo que el hook confirmó. Son **dos invocaciones
solapadas** (pg_cron cada 30 s + Vercel Cron cada minuto): la primera hace el
intento y corre el motor en el hook; la segunda, ~1,5-3 s después, se salta el
intento por cadencia pero **corre el barrido igual** (`runTick` lo llama
siempre). El advisory lock de ADR-008 §3 protege `openAttempt`, no el motor.
Cada transacción lee `currents` y `observations` en sentencias distintas (READ
COMMITTED), y el trigger de versión hace `max + 1` sin cerrojo.

```
decisions (xmin = transacción)          v    xid     decided_at      intento con ese now
ceuta-real-sociedad-b  RN-02 2-1       106  103795  14:00:06.141    no  (barrido de la 2ª)
                       RN-02 2-1       107  103794  14:00:03.308    sí  (hook de la 1ª, commit después)
lugo-racing-ferrol     RN-02 1-1       104  107419  16:30:06.208    sí
                       RN-02 1-1       105  107420  16:30:08.157    no
```

`ingest_attempts` a esas horas: un intento en cada caso (14:00:03.308,
16:30:06.208), ninguno a 14:00:06 ni a 16:30:08. Los 21 pares tienen la misma
forma: uno de los dos `now` tiene intento y el otro no.

**Alcance, sobre toda `decisions`:** 21 Decisions con la tupla repetida de la
anterior (18 `live` RN-01/RN-03 y 3 RN-02: ceuta, lugo y `granada-andorra`
v113), 2 con `decided_at` invertido (ceuta v107, granada-andorra v113), **0 regresiones
`finished → otro`**, 0 alertas `forced_finish` dobles y 0 intentos con error de
unicidad. `girona-albacete` v63, el fixture de SPEC-014, tiene su doble a las
19:46:06Z.

**¿Marcadores o versiones incorrectas?** Marcadores, no: en los 21 casos las dos
Decisions dicen lo mismo. Versiones, sí: dobles, y el orden por versión no es el
orden por `decided_at`. Daño latente, **no observado**: (a) si las dos calculan
el mismo `max + 1`, una muere por unicidad, y si es el hook, pierde las
observaciones de ese tick; (b) una transacción que lee el vigente viejo aplica
la guarda de RN-02 contra él y puede publicar un `live` encima de un `finished`.

**¿Interfiere con RN-12 o con SPEC-014?** RN-12: solo puede duplicarlo con la
misma tupla. CA-5 de SPEC-013 debe contar **partidos**, no filas. SPEC-014: el
dueño por lado se calcula sobre el vigente, así que lo hereda una lectura vieja.
Hoy no hay caso, pero es la misma carrera.

**Veredicto.** Defecto real, sin daño demostrado → **EPIC-MANT**, no EPIC-FIX
(criterio 2 de la épica). No se escribe spec aquí. Arreglo candidato para quien
la escriba: serializar el motor por partido (`pg_advisory_xact_lock` sobre
`match_id`, ordenado, al abrir `decideMatches`) o no barrer cuando la cadencia
salta el intento. Es una decisión de ADR-008/009, no un parche.

## Anexo — consultas (todas en `begin read only`)

```sql
-- Tercera J4: observaciones por partido
select m.id, m.kickoff, count(o.*) obs, count(o.*) filter (where o.status='live') live,
  min(o.observed_at), max(o.observed_at), string_agg(distinct o.status, ',')
from matches m left join observations o on o.match_id=m.id
where m.competition_id='tercera-rfef-g1' and m.round=4 group by m.id, m.kickoff;

-- Últimas Decisions de los dos partidos, con la transacción que las escribió
select match_id, version, xmin::text, status, home_score, away_score, rule, decided_at
from decisions where match_id in ('primera-rfef-g1-2026-27-j5-lugo-racing-ferrol',
  'segunda-division-2026-27-j7-ceuta-real-sociedad-b') order by match_id, version;

-- Intentos alrededor de los cierres
select xmin::text, started_at, ok, observations, details from ingest_attempts
where started_at between '2026-09-26T13:59Z' and '2026-09-26T14:01:30Z'
   or started_at between '2026-09-26T16:29Z' and '2026-09-26T16:31:30Z';

-- Huellas de concurrencia en toda la tabla (lag() por match_id order by version):
-- decided_at < anterior; tupla (status, marcador, minute, added_minute, qualifier)
-- igual a la anterior; finished -> no finished; RN-02 tras RN-02; intentos con
-- error de unicidad; forced_finish dobles.
```

Salida de la última: invertido **2**, tupla repetida **21**, regresión **0**,
RN-02 tras RN-02 **5** (incluye lugo v106, del replay del 09-29, y
mirandes-unionistas v108, con tuplas distintas), unicidad **0**,
`forced_finish` dobles **0**.
