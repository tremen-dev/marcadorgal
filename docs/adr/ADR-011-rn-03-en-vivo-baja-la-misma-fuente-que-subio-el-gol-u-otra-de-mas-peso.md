---
id: ADR-011
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-29, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-011: RN-03 en vivo: baja la misma fuente que subió el gol u otra de más peso

- Deciders: **Alberto Fojo (titular) decide el núcleo el 2026-09-29** —«un marcador en juego lo baja la misma fuente que lo subió u otra de más peso»— porque la letra por peso exige «un operador el 100 % del tiempo vigilando» cada gol anulado, «y no es la intención»; el producto es automático. sdd-arquitecto redacta, mide y propone el resto (§2–§4). Aprobación del ADR: pendiente.
- Specs relacionadas: **SPEC-014** lo implementa. Supersede **solo la letra en vivo de RN-03** de ADR-010 §1 (y su nota fechada); la cláusula del cierre de §1 y §2–§4 siguen vigentes. Evidencia: `_qa/ADR-011/medicion-bajadas.md`.

## Contexto

La letra vigente (commit cf866f9) solo deja bajar un marcador a una fuente con
más peso: hoy, el operador, que es EPIC-004 y no existe. La medición sobre las
2733 capturas crudas de la jornada 2026-09-25/28 da **11 bajadas en vivo: 9
reales y 2 falsas**. RN-03 retuvo las 11: **742 ticks (~373 min) de marcador
falso publicado** en las reales, contra **5 ticks (2,5 min)** de parpadeo
evitado en las falsas. La premisa de que `eibar-las-palmas` (87 ticks) y
`barakaldo-aviles` (46) fueron retenciones acertadas **es falsa**: en los dos el
marcador bajo era el verdadero (gol sin evento; gol anulado por VAR) y acabaron
bien por coincidencia. ADR-010 rechazó «mismo peso» sobre esa premisa.

## Decisión

1. **Núcleo (del titular, no negociable).** Letra nueva de RN-03, la que
   `reglas.md` pasa a decir cuando SPEC-014 se implemente:
   > **RN-03 — Monotonía.** **Mientras el partido está en juego**, un marcador
   > solo lo baja la fuente que lo subió u otra con más peso: un gol que sube el
   > operador no lo baja API-Football, y un gol que sube API-Football lo puede
   > retirar API-Football. Si otra fuente que no pesa más propone un marcador
   > menor que el vigente, se mantiene el vigente y se abre una Alert. **La
   > retención no sobrevive al cierre: al pasar a `finished`, manda el marcador
   > de la observación ganadora.**
2. **Se decide por lado.** Cada lado del marcador tiene **dueño**: la fuente de
   la observación que fijó su valor publicado. Una bajada del lado X la acepta
   el motor si la propone su dueño o una fuente de más prioridad; si no, retiene
   ese lado y abre `regression` como hoy. Tras publicar, el dueño de un lado que
   cambia (suba o baje) es la fuente ganadora; un lado que no cambia conserva
   el suyo.
3. **El motor registra el dueño.** Hoy no lo hace (`src/decide/engine.ts:347-371`
   compara marcadores sin mirar quién los subió). `Decision` gana
   `scoredBy: {home, away}` (SourceId, nulo si no hay marcador) y `decisions`
   dos columnas `home_source_id` y `away_source_id`. Es una migración aditiva;
   las filas antiguas quedan nulas y un dueño nulo se lee como API-Football, la
   única fuente que publicó hasta hoy.
4. **Una bajada aceptada se publica con `rule: RN-01`** y no abre alerta: la
   decide la fuente ganadora y la retención no interviene. Se ve en el log
   porque el marcador baja entre dos versiones (RN-06, RN-07).
5. **RN-06 no se reordena.** RN-03 sigue siendo la regla que se registra cuando
   retiene; solo cambia cuándo retiene.

## Consecuencias

### Positivas
Sobre la jornada: de 742 ticks de marcador mal en vivo a 5, sin operador. Las
9 bajadas reales (3 por VAR, 6 goles fantasma de la fuente) se publican en el
tick en que la fuente las da. Con una
segunda fuente automática (EPIC-004) la regla generaliza sin reescribirse.

### Negativas / follow-ups
- **Con una sola fuente automática, RN-03 no retiene nada en vivo.** Coste
  medido: los parpadeos de la fuente se publican (2 en la jornada: 30 s y
  2 min). Es el precio aceptado.
- Migración de `decisions` y cambio de `Decision` en `src/model`.
- `src/arch/reglas-rn03.test.ts` pasa a leer la cita de este ADR.
- ADR-010 §1 recibe una línea fechada que remite aquí; no se reescribe.

## Alternativas consideradas
- **Filtro de evidencia A** (aceptar solo con evento `Var` visible o si el gol
  subió sin evento `Goal`). Medido: 0 ticks falsos, pero ≈ 313 ticks mal; el
  `Var` llegó 10,5 y 26 min tarde en 2 de 3 casos. **No se propone** (H-1).
- **Filtro B** (aceptar cuando los eventos `Goal` cuadran con el marcador
  bajo). Medido: 4 ticks falsos y ≈ 113 mal; el evento falta o sobra en 163 de
  7679 capturas. **No se propone** (H-1).
- **Mantener «más peso»** (letra vigente). Rechazada por el titular: exige un
  operador vigilando cada gol anulado.
- **Umbral de confirmaciones.** Sigue refutada (ADR-010).
- **Derivar el dueño del historial de Decisions** en vez de guardarlo.
  Rechazada: el motor recibe la Decision vigente, no su historia (ADR-004,
  ADR-009), y el dueño es trazabilidad (RN-06).

## Para el titular
- **H-1** ¿Se confirma el núcleo **sin filtro de evidencia**? Recomendación: sí.
- **H-2** ¿Una bajada aceptada abre alerta informativa? Recomendación: no;
  nadie la resolvería y el log ya la muestra.
- **H-3** ¿Entra RN-12 en el orden de RN-06? En código se evalúa tras RN-02 y
  excluye a RN-03 por construcción (una es en juego, la otra tras el cierre).
  Recomendación: sí, `operador > RN-03 > RN-05 > RN-02 > RN-12 > RN-01`, en
  SPEC-014 CA-1.
