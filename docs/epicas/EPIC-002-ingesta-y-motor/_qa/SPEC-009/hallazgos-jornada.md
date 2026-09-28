# Hallazgos de la jornada de medición (SPEC-009)

> Lo que la medición encontró y **no sale de ningún bloque del informe** tal como
> está escrito el generador. Va aparte para no romper las dos páginas de CA-10.
> Todo medido en solo lectura sobre la ventana 2026-09-25T18:20Z →
> 2026-09-28T21:00Z, 39 partidos. Acompaña a `informe-jornada-2026-09-28.md`.

## Lo que salió bien, y conviene leerlo primero

La ingesta no falló: **cobertura 100 %** (2727 de 2731 ticks), **0 intentos
fallidos** de 2733, **0 horas de ventana sin ejecuciones**, **0 intentos fuera de
la ventana de todo partido**, cadencia mediana **30,0 s** y p95 **32,8 s**, y
latencia interna (captura → publicación) con **mediana y p95 de 0,0 s**. Tres
silencios largos entre jornadas —14,4 h, 15,1 h y 21,3 h— con pg_cron invocando
el tick cada 30 s y el tick declinando cada vez. **Cero intervenciones** de
ningún tipo en los cuatro días.

Los cuatro hallazgos de abajo son de la **fuente** y de las **reglas**, no del
camino de ingesta.

## 1. La fuente no da Terceira en directo — 4 de 9 partidos

Partidos que pasaron de `scheduled` a `finished` **sin una sola observación en
juego**:

| Competición | Sin directo |
|---|---|
| Primeira Federación G1 | 0 de 10 |
| Segunda División | 0 de 11 |
| Segunda Federación G1 | 1 de 9 (`arosa-alaves-b`) |
| **Terceira Federación G1** | **4 de 9** (`boiro-villalbes`, `montaneros-viveiro`, `portonovo-silva`, `sarriana-celta-c`) |

**La cobertura se degrada con la categoría**, que es el riesgo que la épica
declaró, ahora con número. `arosa-alaves-b`: **270 observaciones** de cadencia
perfecta, todas `scheduled null-null`, y un salto a `finished 2-5`; la radio había
cantado sus siete goles en la hora y veinte anteriores.

**No es nuestro** y no tiene arreglo de código. Toca producto: el nicho del
producto es justo donde la fuente falla.

**Y el informe no lo ve**: «partidos sin señal» (CA-4 (b)) busca cero
observaciones o huecos > `SILENCE_MINUTES`, y estos tienen 300 observaciones y
ningún hueco. **Un partido que la fuente nunca mostró en juego es invisible para
la letra de la spec.**

## 2. RN-03 retiene marcadores falsos, y el umbral de confirmaciones NO los separa

8 alertas `regression`. **6 acabaron con el marcador final equivocado; 2 acabaron
bien**, o sea que RN-03 protegió de verdad contra un error de la fuente.

La hipótesis obvia —aceptar una bajada tras N confirmaciones seguidas— **está
refutada por el dato**. Confirmaciones seguidas del marcador más bajo:

| Partido | Confirmaciones | Desenlace |
|---|---|---|
| eibar-las-palmas | **87** (43 min) | **bien**: la fuente se corrigió *hacia arriba* al final |
| girona-albacete | 74 | **mal**: el real era el bajo (2-0, crónica de Marca) |
| celta-fortuna-sabadell | 63 | mal |
| mirandes-unionistas | 51 | mal |
| barakaldo-aviles | 46 | **bien** |
| burgos-eldense | 38 | mal |
| ceuta-real-sociedad-b | 20 | mal |
| lugo-racing-ferrol | **3** | mal |

Los dos aciertos tienen 46 y 87 confirmaciones; el peor fallo tiene 3. **Cualquier
umbral parte el grupo por la mitad.** Con **una sola fuente**, una corrección real
y un error de la fuente son indistinguibles en vivo: es exactamente el problema
que RN-03 fue escrito para no tener que resolver.

**Lo que el dato sí sostiene: que la monotonía no sobreviva al cierre.** Al pasar
a `finished`, el marcador del proveedor manda sobre el retenido. Eso arregla **6
de las 7 discrepancias** sin tocar el comportamiento en vivo, donde la monotonía
sigue protegiendo del parpadeo. Y para el caso 7 hace falta otra cosa (hallazgo
3). Alternativas de más calado, ambas en EPIC-004: **segunda fuente** (RN-04 ya
existe para eso) y **operador**, que es la única vuelta que RN-03 contempla hoy.

Detalle que agrava la cuenta: en `mirandes-unionistas` la **segunda** regresión no
abrió alerta propia. **8 alertas no son 8 marcadores mal, son 8 partidos tocados
con más errores dentro.**

## 3. La fuente no confirma el final — 9 cierres forzosos de 39

Las **9** alertas `forced_finish` tienen todas `minute: 90` y
`lastStatus: "live"`: la fuente deja el partido clavado en el 90 y **nunca manda
el final** dentro de kickoff + 120 min. RN-02 cierra, que es su trabajo.

El precio: `merida-logrones` se cerró con **3-4** y la fuente acabó dando **3-5**.
Es la única de las 7 discrepancias que **no** viene de RN-03, y la que el hallazgo
2 no arregla: necesita reconciliar el marcador después del cierre, que es lo que
`--contrastar` hace a mano una vez por jornada.

Nota para el ledger: la decisión de Alberto en el gate de SPEC-007 —que el cierre
forzoso **abra siempre alerta**— es lo único que hace visible este patrón. Sin
ella, 9 partidos de 39 se habrían cerrado sin que nadie lo supiera.

## 4. El calendario declarado se desfasó 24 h en un partido

`tercera-rfef-g1-2026-27-j4-antela-somozas` tiene kickoff declarado el **domingo
16:00Z** y se jugó el **sábado 16:00Z**. Desfase medido: **−24,0 h exactas**
(primer `live` el 2026-09-26T16:01:06Z, minuto 1).

Efectos:

- El sábado el sistema tenía el partido en `scheduled` **mientras se jugaba**, y
  no publicó ni un marcador en vivo: **una sola Decision**, `finished 1-0`, el
  domingo a las 16:00:06Z.
- Es el **único** partido de los 39 con esa anomalía (barrido completo: 6
  anomalías, las 5 del hallazgo 1 más esta).
- Es también el origen del máximo de cadencia del informe, **82.397 s (22,9 h)**,
  que **no es un tick caído**: es el hueco entre las observaciones del sábado y
  la reapertura de su ventana el domingo. Sin esta nota, ese número se lee como
  un día entero de servicio caído.

**La ingesta sí lo capturó**: 133 observaciones con el `live` progresando del
minuto 1 al 57, porque `live=` devuelve todo lo que esté en juego de nuestras
ligas. Fue el **calendario** el que dejó ciego al motor, no la captura — y por eso
el replay de la rama (c2) también arregla este partido.

Destino: el sync semanal (`calendario-semanal.yml`) corre los martes y propone en
PR; este cambio de día llegó después. La pregunta para el arquitecto es si el
calendario declarado necesita una verificación más cerca de la jornada.

## 5. La latencia extremo a extremo no llega al objetivo

**Mediana +53,2 s frente a los 45 s de `vision.md`: no cumple.** n = 15, rango
[−94,8 s, +2278,2 s]. El p95 no se calcula con n < 20: el informe imprime
`peor caso (n=15)`.

Tres salvedades obligatorias al leerlo:

- **El máximo de 2278,2 s no es latencia.** Es `arosa-alaves-b 2-5`, o sea el
  hallazgo 1: la fuente publicando el resultado final 38 min después del último
  gol. Sin él: n = 14, mediana ≈ +55 s, rango [−95, +267].
- **La referencia es ruidosa.** El gol de `eibar-b-compostela` se anotó con dos
  fuentes: **−1 s contra flashcore y −95 s contra la radio**. La radio es
  carrusel. Así que +53 s es «nuestra publicación frente a la narración de la
  radio», con ruido propio del orden de ±95 s, **no** un «gol → pantalla» limpio.
  La fila duplicada se conserva a propósito: es el único punto de calibración.
- **Instantes al minuto**, cargados con `:00` segundos, lo que adelanta la
  referencia y **agranda** la latencia. El sesgo es conservador a propósito.

Y el contraste que importa: la **latencia interna** (captura → publicación) tiene
mediana y p95 de **0,0 s**. Lo que nos separa del objetivo **no está en nuestro
código**: está en el muestreo a 30 s y en lo que tarda la fuente.

## 9 referencias sin casar, ninguna por error de quien anotó

- 6 de `arosa-alaves-b` + `boiro 1-0` + `portonovo 2-0` → hallazgo 1.
- `mirandes 1-0` → hallazgo 2.

## Residuales que esto abre

- **R-SPEC-009-2** — RN-03 no sabe volver de una bajada; el umbral de
  confirmaciones no sirve; la propuesta con dato detrás es que la monotonía no
  sobreviva al cierre. **sdd-arquitecto** (`reglas.md`, ADR-004).
- **R-SPEC-009-3** — la fuente no cubre en directo el 44 % de Terceira. **Producto**.
- **R-SPEC-009-4** — «partidos sin señal» (CA-4 (b)) no ve un partido que la fuente
  nunca mostró en juego. **sdd-arquitecto**.
- **R-SPEC-009-5** — el calendario declarado se desfasó 24 h y nadie lo detectó
  hasta medirlo. **sdd-arquitecto**.
- **R-SPEC-009-6** — la latencia extremo a extremo no llega a los 45 s de
  `vision.md` con la única referencia externa disponible. **Producto**.
