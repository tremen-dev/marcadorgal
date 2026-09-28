# Handoff — cerrar SPEC-009 el lunes 28 y el martes 29

> Escrito el **domingo 2026-09-27 a las 18:45Z**, con la ventana de medición
> todavía abierta. Para retomar en frío: esto, el guion (`guion-26-27.md`), la
> bitácora (`bitacora-jornada.md`) y el ledger de la spec. Rama
> `ft/SPEC-009-jornada-de-medicion-e-informe`.

## Dónde estamos

La ventana de CA-7 va del **viernes 25 18:20Z al lunes 28 21:00Z** y sigue
corriendo. **Cero intervenciones sobre el dato** (H-2 (i)) y **cero sobre la
plataforma** (H-2 (ii)): las tablas de la bitácora están vacías a propósito.

| CA | Estado |
|---|---|
| CA-1 a CA-5 | código hecho y verificado (3 rondas) antes de la jornada |
| CA-6 | ensayo hecho el 22 · **cerrado** |
| **CA-7** | corriendo; se juzga el lunes con el informe |
| **CA-8** | **fixture capturado** (`live-2026-09-26.json`, commit `0fc76d3`). Falta su **test** en `results.test.ts` y pasar **un crudo real del raw store** por `parse`: es de sdd-implementador |
| **CA-9 / CA-10** | el veredicto y el informe se escriben el lunes tras las 21:00Z |

Faltan por terminar **2 de los 39 partidos**: Oviedo-Sporting (domingo 19:00Z) y
Leganés-Castellón (lunes 18:30Z).

## Números duros al 2026-09-27T18:45Z (solo lectura, para contrastar con el informe)

- `observations` en ventana: **8816** · `decisions`: **3145**
- `ingest_attempts`: **2218**, de ellos **0 fallidos** · peticiones al proveedor:
  **2899** en tres días (presupuesto de SPEC-005 N-4: ~3.000/día → sobra margen)
- ejecuciones de `pg_cron` desde el inicio de la ventana: **5805**
- partidos con Decision `finished`: **37 de 39**
- `alerts`: **8 `regression` · 8 `forced_finish`** · 0 `conflict` · 0 `unresolved_team` · 0 `silence`
- `ingest_attempts` **fuera** de los cuatro días: **33**, y son **las del ensayo de
  CA-6 del 22 de septiembre**, no un fallo del criterio 2. El criterio 2 pregunta
  por intentos fuera de la ventana **de todo partido** dentro de la medición, y eso
  lo calcula el informe (`← criterio 2`).
- `referencias.csv`: **24 filas, 0 mal formadas**, 23 goles distintos (uno medido
  con dos fuentes a propósito), 3 competiciones con Terceira y Segunda Fed.
  dentro → **objetivo de H-3 cumplido**.

## Los tres hallazgos, en orden de importancia

### 1. La fuente no da Terceira en directo — 4 de 9 partidos (44 %)

Cinco partidos de 37 pasaron de `scheduled` a `finished` **sin una sola
observación en juego**: `arosa-alaves-b` (Segunda Fed.) y `boiro-villalbes`,
`montaneros-viveiro`, `portonovo-silva`, `sarriana-celta-c` (Terceira).
Primeira Fed. 0 de 10, Segunda División 0 de 9: **la cobertura se degrada con la
categoría**, que es el riesgo declarado de la épica, ahora con número.

No es nuestro: esos partidos tienen **270-314 observaciones** con cadencia de 30 s
y cero huecos. Es la respuesta del proveedor.

**Y el informe no lo ve**: «partidos sin señal» de CA-4 (b) busca cero
observaciones o huecos > `SILENCE_MINUTES`, y aquí hay 300 observaciones y ningún
hueco. **Un partido que la fuente nunca mostró en juego es invisible para la letra
de la spec.** Destino: sdd-arquitecto, antes de cerrar la épica.

### 2. RN-03 retiene marcadores falsos y no sabe volver — 8 alertas

El proveedor publica un gol fantasma y se retracta; RN-03 («un marcador no baja
salvo por el operador») retiene el falso **hasta el final del partido**, y el
operador es EPIC-004. Caso con referencia externa: `girona-albacete` cerró
`finished 2-1` cuando acabó **2-0** (crónica de Marca).

El motor **cumple la regla al pie de la letra**; lo que falla es la regla.

**Corregido el 2026-09-28**: aquí se decía que la decisión estaba «casi tomada»
con un umbral de dos o tres confirmaciones seguidas. **Las 8 regresiones medidas
lo refutan** — ver `hallazgos-jornada.md`, hallazgo 2. El número de
confirmaciones **no separa** una corrección real de un error de la fuente, y la
propuesta que sí sostiene el dato es otra: **que la monotonía no sobreviva al
cierre**.

Detalle que agrava la cuenta: en `mirandes-unionistas` la **segunda** regresión no
abrió alerta propia, así que **8 alertas no son 8 marcadores mal, son 8 partidos
mal con más errores dentro**.

### 3. La latencia mediana no llega al objetivo — 53 s contra 45 s

Cruce de las 24 referencias contra las Decisions: **n = 15 casadas, mediana
+53 s, rango [−95 s, +2278 s]**, 11 positivas y 4 negativas. Sin el atípico de
`arosa-alaves-b 2-5` (+2278 s, que es la fuente publicando el resultado final, no
latencia): n = 14, mediana ≈ **+55 s**, rango [−95, +267].

**Contraste con `vision.md` (mediana < 45 s): no se cumple.** El p95 no se puede
calcular con n < 20: el informe imprimirá `peor caso (n=15)` (CA-3).

Salvedad obligatoria al escribirlo: **la referencia es ruidosa**. El gol de
`eibar-b-compostela` se anotó con dos fuentes y salió **−1 s contra flashcore y
−95 s contra la radio**, porque la radio es carrusel. Esa fila duplicada se
conserva a propósito: es el punto de calibración. Y las 21 referencias de la tarde
tienen **precisión de minuto**, cargadas con `:00` segundos, lo que **agranda** la
latencia: el sesgo es conservador.

Las 9 referencias que **no casan** no son erratas: 6 son de `arosa-alaves-b`
(hallazgo 1), `boiro 1-0` y `portonovo 2-0` también (hallazgo 1), y
`mirandes 1-0` es el hallazgo 2.

## Lunes 28, después de las 21:00Z — en este orden

1. Salud y cierre del último partido:
   ```sh
   node $SCRIPT --salud      # o npm run tick:salud
   ```
2. Generar el informe **una sola vez** (F-SPEC-009-2: si se regenera después de
   escribir las explicaciones a mano, se pierden):
   ```sh
   npm run informe:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z \
     --referencias docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/referencias.csv \
     --contrastar \
     --salida docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/informe-jornada-2026-09-28.md
   ```
3. Escribir a mano la **explicación de cada alerta** en el bloque 7. Con 16
   alertas y solo dos huecos impresos, las demás se explican **por `kind`**
   (F-SPEC-009-4): `regression` → hallazgo 2; `forced_finish` → RN-02 cerrando a
   kickoff + 120 sin que la fuente confirme el final.
4. Resolver en el ledger las **tres declaraciones pendientes** del bloque 9
   (F-SPEC-009-1), que ninguna consulta puede derivar. La bitácora las tiene:
   **cero intervención sobre el dato, cero sobre la plataforma**, y las alertas
   explicadas en el paso 3.
5. Añadir al informe los **tres hallazgos** de arriba: el 1 y el 3 no salen de
   ningún bloque tal como está escrito el generador.
6. Veredicto de CA-9. Lectura previa, para que no se decida al leer los números:
   la ingesta está impecable (0 intentos fallidos, cadencia de 30 s, sin huecos),
   así que **no es (c1)**. Las Decisions equivocadas de RN-03 son **(c2)**, que
   **no obliga a repetir la jornada**: se corrige y se recalcula sobre las
   observaciones guardadas (crudo 30 días, ADR-004, SPEC-007 CA-8). Y el hallazgo
   1 no es ninguna de las tres ramas: **no es fallo del sistema, es cobertura de
   la fuente**, y hay que decirlo con esas palabras.
7. La spec pasa a `en-revision`. Residuales nuevos: **R-SPEC-009-2** (RN-03),
   **R-SPEC-009-3** (cobertura de la fuente en Terceira), **R-SPEC-009-4** (la
   letra de CA-4 (b) no ve un partido nunca mostrado en juego), más el heredado
   **R-SPEC-009-1** (Primera División, jornada del 9-12 de octubre).

## Martes 29 — en este orden, y no antes

1. **La consecuencia de código de la enmienda de CA-9 (a)** (N-8): partir
   `acordadosNoFinished` de `src/ingest/informe.ts` en dos, `postponed` acordado
   (no baja el veredicto) y `suspended`/`scheduled`/`live` acordados (siguen
   bajando). **Va primero**, porque cambia el veredicto, no la maquetación.
2. **V-8**: el tope de `INFORME_MAX_LINEAS` (145) se pasa (150-153) con las listas
   todas acotadas; tres ejes que el fixture del implementador no expresaba.
3. **V-9**: F-SPEC-009-3 y F-SPEC-009-4 dicen «a diez filas» cuando ya son cinco.
4. Regenerar el informe entero (camino de solo lectura, filas append-only) y
   **ese** es el informe con el veredicto definitivo.

## Lo que sigue congelado

Código congelado desde el 2026-09-22 salvo lo del martes. **Nada de tocar
`observations`, `decisions`, `alerts`** ni lanzar ticks a mano: invalidaría el
criterio 5 con la jornada ya capturada. Arreglar RN-03 **no** es de esta spec:
`reglas.md` y ADR-004 son de sdd-arquitecto, vía `/sdd-orquestador`.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Este handoff, guion, bitácora, referencias | `docs/epicas/EPIC-002-ingesta-y-motor/_qa/SPEC-009/` |
| Fixture de CA-8 | `src/sources/api-football/fixtures/live-2026-09-26.json` + fila en su `README.md` |
| Workflow de captura (temporal, borrar al cerrar) | `.github/workflows/captura-ca8.yml` y la rama `captura-ca8` |
| Scripts temporales (`captura-ca8.mjs`, `gol.mjs`) | scratchpad de la sesión del 25-27; **no sobreviven**, y no hacen falta ya |
| Commits de la jornada | `5b0d2e1`, `f44ae23`, `76987a2`, `f2c874c`, `7d8f990`, `0fc76d3`, `8e43f1c`, `2268f3f`, `a74d69f` |
