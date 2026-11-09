# Evidencias QA — SPEC-056

Evidencias visuales del despliegue interactivo de goleadores por equipo y marcado de goleador reciente en el dashboard de `marcador.gal`.

## Capturas generadas

### 1. Fila cerrada con goles (`01-fila-cerrada.png`)
- **Estado:** Partido con goles disponibles, estado colapsado inicial.
- **Afordance:** Indicador discreto `▸` bajo el margen del minuto.
- **Interacción:** `cursor: pointer`, atributos de botón accesible (`role="button"`, `aria-expanded="false"`).
- **Espacio vertical:** Mantiene la altura compacta estándar de la fila (sin ocupar espacio extra hasta que se solicita).

### 2. Fila desplegada por equipo tras click/tap (`02-fila-abierta.png`)
- **Estado:** Panel de goles abierto tras pulsar la fila.
- **Afordance:** El indicador conmuta a `▾`.
- **Distribución por equipos:**
  - Columna local (`home`): `Deportivo ABANCA` con su goleadora (`⚽ Millene 23' (p.)`).
  - Columna visitante (`away`): `FC Barcelona Femení` con sus goleadoras (`⚽ Alexia 45'`, `⚽ Aitana 61' (p.p.)`).
- **Minuto y tipo:** Formato `[minuto]'` con sufijo `(p.)` en ámbar para penaltis y `(p.p.)` para goles en propia meta.

### 3. Fila con goleador reciente y marca "GOL" (`03-goleador-reciente.png`)
- **Estado:** Gol anotado dentro de la ventana de frescura reciente (`RECENT_GOAL_MINUTES`).
- **Marcador:** El número del equipo local pulsa con el recuadro `recentGoalBox` de SPEC-041.
- **Goleador reciente:** El autor del gol reciente (`⚽ Ainhoa Marín 74'`) se resalta y muestra la pastilla naranja pulsante `GOL` (`--directo`), sincronizada temporalmente con el reloj del cliente.
- **Goles anteriores:** Los goles anotados con anterioridad (`Millene 23'`) no llevan la marca reciente.

### 4. Fila sin goles (`04-fila-sin-goles.png`)
- **Estado:** Partido 0-0, sin goles o sin eventos disponibles.
- **Comportamiento:** `cursor: default`, no muestra indicador `▸` ni rol interactivo. El click o tap no produce ninguna acción.
