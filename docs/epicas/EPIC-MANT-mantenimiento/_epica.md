---
id: EPIC-MANT
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-21, por: sdd-producto}
---
# EPIC-MANT — Mantenimiento

## Objetivo

Cubo permanente para el trabajo que no entrega capacidad nueva pero evita que
la existente se pudra: fallos silenciosos, deuda que ya mordió una vez,
observaciones de verificación que no bloqueaban su spec. No tiene fecha de
cierre ni compite por prioridad con las épicas de producto; se vacía cuando
algo de dentro se vuelve urgente o cuando hay hueco entre épicas.

Existe porque sin él estas cosas se anotan en el ledger de una spec cerrada y
mueren ahí: nadie relee el ledger de una spec en `hecho`.

## Criterios de éxito

1. Toda observación que sobrevive a una verificación sin bloquearla tiene un
   destino explícito: se arregla en su spec, se descarta con razón escrita, o
   entra aquí. Ninguna se queda solo en el ledger de una spec cerrada.
2. Nada que esté aquí es un fallo que ya esté haciendo daño en producción: eso
   es EPIC-FIX y salta la cola.

## Alcance

- Dentro: fallos silenciosos que aún no han mordido; deuda técnica con un modo
  de fallo concreto y escrito; observaciones de verificación no bloqueantes;
  arreglos de tooling, workflows y scripts.
- Fuera (aparcado a propósito, no por descuido): fallos activos en producción
  (EPIC-FIX); mejoras de producto y capacidad nueva (su épica); refactores sin
  un modo de fallo concreto detrás, que son gusto y no mantenimiento.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

Pendientes de especificar, con su procedencia:

- **M-1 — `git status` fallido se lee como «no hay cambios»** en el workflow
  `calendario-semanal.yml`. El paso «¿Hay diff en el calendario declarado?»
  decide con `if [ -z "$(git status --porcelain …)" ]`: si el comando fallara,
  la sustitución sale vacía y el workflow concluye que no hay nada que
  sincronizar. Mismo género de silencio que O-2 de SPEC-008 —el `tee` que se
  tragaba el estado de salida— pero sin tubería, así que `shell: bash` no lo
  alcanza: ni `-e` ni `pipefail` cubren una sustitución dentro de `[`.
  Procedencia: observación del implementador de SPEC-008, 2026-09-21. No
  bloqueaba su spec. El workflow corre los martes.
- **M-2 — cota de lotes en `purgeRaw`.** Observación del verificador de
  SPEC-006; no ha aparecido en la práctica.
- **M-3 — lector de YAML propio en `src/arch/deploy.test.ts`.** ~70 líneas
  escritas para evitar una dependencia (verificado que no había alternativa en
  Node 26 ni en el lock). Sobra el día que entre una librería de YAML al
  proyecto. Procedencia: SPEC-008 O-1.

## Riesgos

- El cubo se llena y no se vacía nunca. Mitigación: cada entrada nace con su
  modo de fallo escrito, así que se puede priorizar por daño y no por
  antigüedad; lo que no tenga modo de fallo concreto no entra.
