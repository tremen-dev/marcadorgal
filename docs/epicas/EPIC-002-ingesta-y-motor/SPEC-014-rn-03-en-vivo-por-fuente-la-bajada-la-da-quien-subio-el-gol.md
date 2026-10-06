---
id: SPEC-014
tipo: spec
epica: EPIC-002
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-29, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-06, por: sdd-implementador}
---
# SPEC-014 — RN-03 en vivo por fuente: la bajada la da quien subió el gol

## Problema
RN-03 solo deja bajar un marcador en juego a una fuente con más peso; hoy, el
operador, que no existe (EPIC-004). En la jornada medida eso dejó **742 ticks
(~373 min)** de marcador falso publicado en vivo en 9 bajadas reales, para
evitar **5 ticks** de parpadeo en 2 falsas (`_qa/ADR-011/medicion-bajadas.md`).
El titular decide (2026-09-29) que un marcador en juego lo baja **la fuente que
lo subió u otra de más peso**. **ADR-011** fija la letra, el dueño por lado y su
registro. Esta spec lo implementa.

## Usuarios / roles afectados
- Titular: aprueba antes ADR-011 y responde H-1..H-3 del ADR.
- sdd-arquitecto: escribe la letra de CA-1 (el hook protege-verdad; precedente
  F-SPEC-013-1).
- Público: deja de ver goles fantasma retenidos; ve los parpadeos de la fuente.

## Criterios de aceptación
- **CA-1 La verdad dice lo que ADR-011 fija.** RN-03 de `reglas.md` es idéntica al bloque citado de ADR-011 §1, con una nota nueva `*Enmendada el <fecha> por ADR-011.*` bajo la de ADR-010; el no-negociable de `FOUNDATION.md` dice «la fuente que lo subió u otra con más peso (RN-03, ADR-011)»; ADR-010 §1 **no se reescribe**: gana una línea fechada que remite a ADR-011 (supersede parcial: la cláusula del cierre y §2–§4 siguen vigentes, y bloquear ADR-010 entero dejaría sin respaldo a SPEC-013). RN-06 sin cambio, salvo H-3 = sí (entonces `operador > RN-03 > RN-05 > RN-02 > RN-12 > RN-01`). Verificable: `src/arch/reglas-rn03.test.ts` adaptado para leer la cita de ADR-011 y las dos notas, en verde.
- **CA-2 El dueño de cada lado existe de punta a punta.** Migración SQL aditiva: `decisions.home_source_id` y `decisions.away_source_id` (`text`, nulas). `Decision` en `src/model` gana `scoredBy: {home, away}`. Tests: `model.test.ts` (parse con y sin dueño) y `engine.db.test.ts` (inserta y lee los dos campos, en transacción con rollback).
- **CA-3 El motor decide la bajada por lado.** En `src/decide/engine.ts`, tests en `engine.test.ts`: (i) API-Football sube 2-1 y propone 2-0 en vivo → publica **2-0**, `rule: RN-01`, sin alerta; (ii) el operador sube 1-0 y API-Football propone 0-0 → retiene 1-0 y abre `regression`; (iii) lados con dueños distintos (local: operador, visitante: API-Football) y API-Football propone 0-0 desde 1-1 → publica **1-0**, `rule: RN-03`, con alerta; (iv) una segunda fuente de prioridad igual o menor que el dueño propone menos → retiene y alerta; (v) dueño nulo se trata como `api-football`; (vi) los casos de cierre de SPEC-012 CA-2 y de RN-12 de SPEC-013 siguen en verde; solo se tocan para añadir la marca de CA-8 a sus fixtures y el `details` de CA-10.
- **CA-4 El dueño se registra bien.** Tests en `engine.test.ts`: un lado que sube o baja toma como dueño la fuente ganadora; un lado que no cambia conserva el suyo; una retención conserva el dueño del lado retenido; un marcador nulo lleva dueños nulos. El adaptador de `src/ingest/engine.ts` lee y escribe los dos campos.
- **CA-5 El fixture de `girona-albacete` lo demuestra.** En `src/decide/replay.test.ts`, contra el fixture del repo y nunca contra red ni base: con el motor de hoy, entre 19:46:04Z y el final se publica `live 2-1`; con el de esta spec, `live 2-0` desde 19:46:04Z.
- **CA-6 El efecto en la jornada, medido y sin escribir.** `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` **sin `--aplicar`** imprime por partido y en total los ticks `live` en que el marcador publicado difiere del de la fuente, con el motor de hoy y con el de esta spec. Esperado: ≈ **742 → 0** en bajadas reales y **5** ticks de bajada falsa publicada (filas 3 y 11 de la medición); una desviación se explica en el ledger. Conteo de `decisions` idéntico antes y después. `--aplicar` solo por decisión humana.
- **CA-7 Gates y nada de más.** `npm run gates` → 0 y `npm run test:db` en verde. Una migración; `package.json` sin dependencias nuevas.
- **CA-8 El cierre forzoso lleva marca propia (F-SPEC-013-5).** En la migración de CA-2, `decisions.forced_finish boolean` **nula**; `Decision` gana `forcedFinish: boolean | null`. Solo la rama de cierre forzoso de RN-02 en `src/decide/engine.ts` escribe `true`; toda otra Decision del motor escribe `false`, y `replay:jornada --aplicar` también `false`: una corrección no es un cierre, y su `rule` sigue siendo RN-02 (SPEC-012 CA-4 no cambia). Las filas anteriores quedan `null`, sin actualizar nada (ADR-006, RN-07), y `null` se lee como «no es cierre forzoso». RN-12 en el motor, `isInWindow` (`src/ingest/window.ts`, que deja de recibir `rule`) y la guarda de `reconciliar:cierre` (`src/ingest/reconciliacion.ts`) deciden por `forcedFinish === true`, nunca por `rule`. Tests: `engine.test.ts` (el cierre forzoso sale con `true`; RN-01 y RN-12, con `false`; un `finished` RN-02 con marca `false` o `null` más una observación `finished` no publica RN-12); `window.test.ts` (un `finished` RN-02 sin marca queda fuera de ventana; con marca, dentro hasta +150); `reconciliacion.test.ts` (rehúsa un RN-02 sin marca antes de pedir nada); `replay-jornada.test.ts` (la corrección lleva `false`); `engine.db.test.ts` (ida y vuelta de `true`, `false` y `null`).
- **CA-9 «`finished` confirmado» tiene una sola lectura (F-SPEC-013-3).** En ADR-010 §3 y en SPEC-013 CA-4 (iv), «`finished` confirmado» significa **cualquier `finished` sin la marca de CA-8**, tenga el cualificador que tenga; no significa el cualificador `confirmado`. Un `finished` así saca al partido de la ventana y no admite RN-12. Aparte, y sin cambios desde SPEC-007, el cualificador `confirmado` no admite nada salvo el operador, y un `finished` `provisional` sin marca sigue aceptando otro `finished` por RN-01. Junto a la de CA-1, ADR-010 §3 gana una sola línea fechada que remite aquí. Tests en `engine.test.ts`: (i) `finished` RN-01 `provisional` sin marca más una observación `finished` mayor → `rule: RN-01`, nunca `RN-12` (el test de SPEC-007 «does publish a finished with a higher score (RN-01)» sigue en verde); (ii) `finished` RN-12 `confirmado` más una observación `finished` distinta → no se publica nada. En `window.test.ts`: `finished` RN-01 `provisional` sin marca → fuera de ventana.
- **CA-10 La alerta del cierre forzoso cuenta lo publicado (F-SPEC-012-5).** `forced_finish` guarda en `details.score` el marcador de la Decision que publica el cierre (el de la observación ganadora si la hay; si no, el vigente) y en `details.heldScore` el vigente justo antes del cierre, que es lo que `score` guarda hoy y así no se pierde. Tests en `engine.test.ts`: vigente `1-1` y observación fresca `live 1-0` → `score` `1-0` y `heldScore` `1-1`; sin observación fresca → los dos, el vigente. Las alertas ya abiertas no se reescriben (ADR-006).

## Entidades y reglas afectadas
Decision, Observation, Alert (dominio.md). **RN-03** (la enmienda), RN-01
(publica la bajada aceptada), RN-06 (trazabilidad del dueño), RN-07 (la
migración es aditiva), RN-02 y RN-12 (la marca del cierre forzoso, CA-8 a CA-10). **ADR-011** es lo que se ejecuta; ADR-010 §1 (cierre)
y §2–§4, ADR-004 y ADR-009 §3 siguen vigentes.

## Fuera de alcance
- Filtro de evidencia (`Var`, eventos `Goal`): medido y no propuesto (ADR-011, H-1).
- Resolver las alertas `regression` abiertas y el operador: EPIC-004.
- Corregir con `--aplicar` las Decisions en vivo de la jornada: no cambian ningún final.
- Reescribir `hallazgos-jornada.md` o SPEC-012 N-2: son evidencia fechada; la corrección vive en la medición.
- Marcar a posteriori las Decisions y alertas `forced_finish` anteriores a la migración: quedan `null` o como están (ADR-006).

## Notas para el gate humano
- **N-1 No se aprueba antes que ADR-011**, ni se empieza antes de fusionar SPEC-013: las dos tocan `engine.ts` y migraciones.
- **N-2 La premisa del encargo no aguanta el dato.** `eibar-las-palmas` (87) y `barakaldo-aviles` (46) no fueron retenciones acertadas: el marcador bajo era el verdadero. «Misma fuente» no rompe ningún acierto largo; solo publica 2 parpadeos de 30 s y 2 min.
- **N-3 El crudo se purga el 2026-10-25.** La medición ya está hecha y los ticks de CA-6 salen de `observations`, que no se purgan.
- **N-4 Absorbidas por decisión del titular, 2026-09-29.** Alberto Fojo mete aquí F-SPEC-012-5, F-SPEC-013-3 y F-SPEC-013-5 (CA-8 a CA-10) porque tocan el mismo motor y la misma migración. Es un cambio de alcance que él autoriza, y la spec sigue en `aprobada`. **Para mirar con lupa**: (a) la marca es una **columna propia y nula**, no un valor de `rule` ni de cualificador. Una regla nueva para las correcciones rompería la letra de SPEC-012 CA-4, y un cualificador nuevo sería visible y tocaría `dominio.md`. Con una columna nula no hace falta rellenar nada. (b) Los 9 cierres forzosos de la jornada quedan `null`, así que ni RN-12 ni `reconciliar:cierre` los vuelven a tocar: ya están conciliados, 39 de 39 (SPEC-013 CA-6). (c) `heldScore` es un campo nuevo. (d) El único cambio en ADR-010 es una línea fechada en §3.
