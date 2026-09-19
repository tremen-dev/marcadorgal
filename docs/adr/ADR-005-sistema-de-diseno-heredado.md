---
id: ADR-005
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
---
# ADR-005: El sistema de diseño heredado es vinculante, con excepciones listadas

- Deciders: sdd-arquitecto propone; Alberto Fojo aprueba (2026-09-20).
- Specs relacionadas: EPIC-003, EPIC-004.

## Contexto

`docs/diseno/` es una copia íntegra del sistema de diseño de la versión previa
(tokens, marca, componentes, layouts de escritorio y móvil). Está pensado para
exactamente este producto y D-8 lo declara vinculante. Tiene algunas
divergencias con el dominio que hay que resolver antes de codificarlo.

## Decisión

- `docs/diseno/` **no se edita**. Es la referencia. Las desviaciones se listan
  aquí y en `docs/diseno/HERENCIA.md`.
- Los tokens se transcriben a `src/design/tokens.ts` y se generan como
  variables CSS. Un test de paridad compara `tokens.ts` con `_tokens.css`.
- Semántica de color inviolable: **ember `#FF6B00` solo para `live`; ámbar
  `#F0B135` para lo que espera a una persona (aprazado, suspendido,
  provisional); rojo `#FF655A` para sen sinal y conflicto; verde `#56DB8F`
  solo marca, nunca estado.** Ningún estado ni cualificador se comunica solo
  con color: siempre etiqueta textual.
- Dígitos tabulares en todo número. Sin escudos. Solo modo oscuro. Geist
  autoalojada. Objetivo táctil 44 px, foco visible, campos ≥ 16 px.

### Excepciones (lo que no se hereda)
1. Literales de estado: se usan los de `dominio.md` (Programado · En xogo ·
   Rematado · Aprazado · Suspendido), no `FIN`, `APR`, `DESC` ni «Directo».
2. `?` y `!` como etiquetas de cualificador se sustituyen por texto traducible.
3. `--fg-prov` desaparece: provisional y confirmado van en `--fg` con etiqueta.
4. La vista «Global» de columnas y el panel de detalle de escritorio quedan
   fuera de v1; se hereda la fila ampla y el layout móvil.
5. La marca de agua para capturas se hereda como idea; su forma final se decide
   en la spec de la pantalla.

## Consecuencias

### Positivas
Cero decisiones de diseño desde cero. La pantalla se especifica contra medidas
concretas (fila 52 px, cabecera 52 px, tira de días 40 px).

### Negativas / follow-ups
El sistema no tiene breakpoints: los define la spec de la pantalla entre 360 y
1440 px. Modo claro no existe y no se añade en v1.

## Alternativas consideradas

- **Rediseñar**: tira un trabajo terminado y coherente con la visión.
- **Adoptar Tailwind con los tokens**: capa extra sin beneficio (ADR-001).
