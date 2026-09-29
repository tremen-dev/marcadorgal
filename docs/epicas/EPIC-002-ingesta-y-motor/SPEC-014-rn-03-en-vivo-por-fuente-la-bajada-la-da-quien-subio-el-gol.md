---
id: SPEC-014
tipo: spec
epica: EPIC-002
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-09-29, por: sdd-arquitecto}
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
- **CA-3 El motor decide la bajada por lado.** En `src/decide/engine.ts`, tests en `engine.test.ts`: (i) API-Football sube 2-1 y propone 2-0 en vivo → publica **2-0**, `rule: RN-01`, sin alerta; (ii) el operador sube 1-0 y API-Football propone 0-0 → retiene 1-0 y abre `regression`; (iii) lados con dueños distintos (local: operador, visitante: API-Football) y API-Football propone 0-0 desde 1-1 → publica **1-0**, `rule: RN-03`, con alerta; (iv) una segunda fuente de prioridad igual o menor que el dueño propone menos → retiene y alerta; (v) dueño nulo se trata como `api-football`; (vi) los casos de cierre de SPEC-012 CA-2 y de RN-12 de SPEC-013 siguen en verde sin tocarlos.
- **CA-4 El dueño se registra bien.** Tests en `engine.test.ts`: un lado que sube o baja toma como dueño la fuente ganadora; un lado que no cambia conserva el suyo; una retención conserva el dueño del lado retenido; un marcador nulo lleva dueños nulos. El adaptador de `src/ingest/engine.ts` lee y escribe los dos campos.
- **CA-5 El fixture de `girona-albacete` lo demuestra.** En `src/decide/replay.test.ts`, contra el fixture del repo y nunca contra red ni base: con el motor de hoy, entre 19:46:04Z y el final se publica `live 2-1`; con el de esta spec, `live 2-0` desde 19:46:04Z.
- **CA-6 El efecto en la jornada, medido y sin escribir.** `npm run replay:jornada -- 2026-09-25T18:20Z 2026-09-28T21:00Z` **sin `--aplicar`** imprime por partido y en total los ticks `live` en que el marcador publicado difiere del de la fuente, con el motor de hoy y con el de esta spec. Esperado: ≈ **742 → 0** en bajadas reales y **5** ticks de bajada falsa publicada (filas 3 y 11 de la medición); una desviación se explica en el ledger. Conteo de `decisions` idéntico antes y después. `--aplicar` solo por decisión humana.
- **CA-7 Gates y nada de más.** `npm run gates` → 0 y `npm run test:db` en verde. Una migración; `package.json` sin dependencias nuevas.

## Entidades y reglas afectadas
Decision, Observation, Alert (dominio.md). **RN-03** (la enmienda), RN-01
(publica la bajada aceptada), RN-06 (trazabilidad del dueño), RN-07 (la
migración es aditiva). **ADR-011** es lo que se ejecuta; ADR-010 §1 (cierre)
y §2–§4, ADR-004 y ADR-009 §3 siguen vigentes.

## Fuera de alcance
- Filtro de evidencia (`Var`, eventos `Goal`): medido y no propuesto (ADR-011, H-1).
- Resolver las alertas `regression` abiertas y el operador: EPIC-004.
- Corregir con `--aplicar` las Decisions en vivo de la jornada: no cambian ningún final.
- Reescribir `hallazgos-jornada.md` o SPEC-012 N-2: son evidencia fechada; la corrección vive en la medición.

## Notas para el gate humano
- **N-1 No se aprueba antes que ADR-011**, ni se empieza antes de fusionar SPEC-013: las dos tocan `engine.ts` y migraciones.
- **N-2 La premisa del encargo no aguanta el dato.** `eibar-las-palmas` (87) y `barakaldo-aviles` (46) no fueron retenciones acertadas: el marcador bajo era el verdadero. «Misma fuente» no rompe ningún acierto largo; solo publica 2 parpadeos de 30 s y 2 min.
- **N-3 El crudo se purga el 2026-10-25.** La medición ya está hecha y los ticks de CA-6 salen de `observations`, que no se purgan.
