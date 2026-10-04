---
id: ADR-013
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-04, por: sdd-arquitecto}
---
# ADR-013: Partido sin directo de la fuente: prórroga de la ventana hasta el final y `sen_sinal` en `scheduled`

- Deciders: sdd-arquitecto propone (2026-10-04) a partir del hallazgo de campo del mismo día que encargó **Alberto Fojo (titular)**, con la intención de ADR-011: automático, sin operador vigilando. **Decide Alberto Fojo, H-1..H-6.**
- Specs relacionadas: la implementa una **SPEC-018** que se escribe tras el gate. Toca la definición de **Ventana** (`dominio.md`, ADR-002 §2), **RN-05** y el modelo (`sen_sinal` solo en `live`). No toca RN-02, ADR-010 ni ADR-012. Evidencia: `docs/epicas/EPIC-002-ingesta-y-motor/_qa/fuente-sin-directo/medicion.md`.

## Contexto

En Tercera y Segunda RFEF la fuente a veces no cubre un partido en directo: lo
tiene a su hora, en `NS`, y publica el `FT` al final. Medido desde el
2026-09-25: **8 partidos** con calendario bueno. 6 dieron `FT` entre **+125 y
+147** y pasaron de `scheduled` a `finished` sin `live`. **2 de 8** lo dieron
después de +150, o no lo han dado: la ventana se cerró y `board` los muestra
«por jugar» para siempre. Ninguno abre alerta. En los 8, mientras se jugaba,
`board` dijo `scheduled`. ADR-012 no aplica: no hay `PST`.

## Decisión (propuesta)

1. **Prórroga sin directo.** Un partido cuya Decision vigente a kickoff + 150
   sigue `scheduled` se queda en ventana hasta que la fuente dé `finished`,
   `postponed` o `suspended`, o hasta **kickoff + 6 h** (H-1). En la prórroga
   se sondea solo por `ids=`, **cada 5 min** (H-2). Letra nueva de **Ventana**:
   > De kickoff − 10 min a kickoff + 150 min, o hasta `finished`. Si a
   > kickoff + 150 sigue `scheduled`, se prorroga hasta kickoff + 6 h, con
   > sondeo cada 5 min.

   RN-08 no cambia: sigue sin haber petición fuera de ventana. El `FT` entra
   como hoy, por RN-01 y `provisional`, y deja Observation y crudo.
2. **`sen_sinal` también en `scheduled`** (H-3). Letra nueva de RN-05:
   > Un partido `live` sin observación nueva en 15 minutos, o `scheduled` con
   > kickoff pasado hace 15 minutos sin que ninguna fuente lo dé en juego,
   > pasa a cualificador `sen_sinal`. En `live` abre una Alert; en `scheduled`, no.

   Al llegar `live`, `finished`, `postponed` o `suspended` vuelve el
   cualificador normal. En el modelo, el `refine` de `src/model/entities.ts` y
   `decisions_sen_sinal_check` admiten `sen_sinal` con `status` `live` o
   `scheduled`: una migración. No hay estado nuevo: siguen siendo cinco.
3. **Al acabar la prórroga** el partido queda `scheduled · sen_sinal`. No se
   inventa un `finished`. Lo sacan de ahí `calendario:load`, si el partido se
   reprograma, o el operador (EPIC-004).
4. **Informe de jornada.** Una línea `sin directo y sin final: N` en el bloque 6,
   al lado de la de SPEC-017 CA-3. No entra en el veredicto. Va en SPEC-018,
   no en SPEC-017.

## Consecuencias
### Positivas
Con §1, los 6 de (b) no cambian y los 2 de (a) se cierran si la fuente publica
el `FT` antes de +6 h. Con §2, nadie ve «por jugar» en un partido que se está
jugando. EPIC-003 pinta un cualificador que ya existe. Coste de §1: unas 42
peticiones por prórroga completa (3,5 h a una cada 5 min), y los rezagados de
la misma hora van en un solo `ids=`.

### Negativas / follow-ups
- **El horizonte de +6 h es una hipótesis**: no se sabe cuándo publica el
  proveedor el `FT` tardío (R-ADR-013-2, H-5).
- **Cadencia por partido**: hoy la cadencia es de la fuente (RN-08,
  `minIntervalSeconds`). La prórroga añade un paso más lento dentro del mismo
  límite. Se decide en SPEC-018.
- Un partido con el kickoff mal declarado (más tarde en la realidad) sale
  `sen_sinal` desde +15. Es honesto, pero no lo arregla: eso es SPEC-015.
- `sen_sinal` en `scheduled` cambia una invariante del modelo. El test que
  lo prohíbe (`src/model/model.test.ts`) se invierte.
- **R-ADR-013-1**: `bergantinos-coruxo` y `barco-pontevedra-b` siguen
  `scheduled` en `dev` (H-6).

## Alternativas consideradas
- **Estado nuevo** («sin datos»). Rechazada: son cinco estados y solo cinco.
- **Solo una alerta al cierre de ventana.** Rechazada: nadie la resuelve hasta
  EPIC-004, y el partido seguiría «por jugar» (como en ADR-012 H-2).
- **Que EPIC-003 lo pinte distinto** a partir de `kickoff` y `scheduled`.
  Rechazada: la regla viviría en la interfaz y no en el motor (D-5), y no
  traería el resultado.
- **Esperar al operador (EPIC-004).** Rechazada: es el operador al 100 % que el
  titular descartó en ADR-011.
- **Subir `WINDOW_AFTER_MINUTES` para todos.** Rechazada: los 61 con directo
  no lo necesitan, y un número fijo no cubre un `FT` que llega tarde.
- **Contraste `ids=` automático tras la jornada.** Rechazada por lo mismo que
  en ADR-010: corrige fuera del almacén y abre una excepción a RN-08.
- **Cerrar a +150 con `finished` sin marcador.** Rechazada: inventa un estado
  que ninguna fuente dio.

## Para el titular (H-n, con recomendación)
- **H-1** ¿Prórroga hasta kickoff + 6 h? Recomendado: sí. La alternativa es
  hasta las 23:59 locales del día.
- **H-2** ¿Sondeo cada 5 min en la prórroga? Recomendado: sí. Con 30 s serían
  unas 420 peticiones por partido.
- **H-3** ¿`sen_sinal` en `scheduled` o un cualificador nuevo (`sen_directo`)?
  Recomendado: reutilizar `sen_sinal`, sin vocabulario nuevo.
- **H-4** ¿Sin alerta para `scheduled · sen_sinal`? Recomendado: sin alerta,
  como ADR-012 H-2.
- **H-5** ¿Autorizas **una** petición `ids=1572068-1612741` para medir R-ADR-013-2
  antes de fijar H-1? Recomendado: sí, 1 de 7.500/día.
- **H-6** ¿Se quedan los dos de `dev` como están, igual que ADR-012 H-3?
  Recomendado: sí. Si H-5 trae su `FT`, SPEC-018 puede reconciliarlos, guardando
  primero el crudo.
