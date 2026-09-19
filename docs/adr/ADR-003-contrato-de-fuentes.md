---
id: ADR-003
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
---
# ADR-003: Contrato de fuentes `SourceAdapter` y registro

- Deciders: sdd-arquitecto propone; Alberto Fojo aprueba (2026-09-20).
- Specs relacionadas: EPIC-002, EPIC-004.

## Contexto

Habrá fuentes de cuatro tipos: API de proveedor (pull), web con acuerdo (pull),
webhook (push) y operador (push). D-4 exige que todas implementen el mismo
contrato y que añadir una sea añadir una carpeta. D-7 saca la base legal del
código.

## Decisión

```ts
interface SourceAdapter {
  readonly id: SourceId;
  readonly kind: 'pull' | 'push';
  // pull: nosotros preguntamos
  fetch?(ctx: FetchContext): Promise<RawCapture>;   // red; recibe partidos en ventana
  parse(raw: RawCapture): ParsedObservation[];      // puro
  // push: nos llega un payload
  verify?(req: Request): Promise<boolean>;          // firma o token
  ingest?(payload: unknown): ParsedObservation[];   // puro
  // identidad
  resolveTeam(external: string, competition: CompetitionId): TeamId | null;
}
```

- `ParsedObservation` es una Observation sin id ni referencia a crudo: el
  núcleo de ingesta añade ambos. El adaptador nunca escribe en base de datos.
- `parse` e `ingest` son puros y se prueban con fixtures reales guardados en
  `src/sources/<id>/fixtures/`. Nunca contra la red.
- `resolveTeam` lee `data/alias/<temporada>/<id>.json`. Sin alias, devuelve
  `null` y la observación queda pendiente (RN-10).
- **Registro** en `src/sources/registry.ts`: por fuente, `kind`, competiciones
  cubiertas, prioridad por competición, cadencia mínima entre peticiones,
  user-agent, y un campo `legalBasis` de texto libre que solo se anota (D-7).
  Es configuración validada con zod, no código ramificado.
- **Frontera**: `src/sources/*` solo importa de `src/model`. Un test de
  arquitectura lo comprueba en cada PR.
- Errores de un adaptador se registran en `ingest_attempts` y no detienen el
  tick para el resto.

## Consecuencias

### Positivas
Cada fuente se desarrolla y prueba aislada, con fixtures. Cambiar de proveedor
es cambiar una carpeta y una entrada del registro. La prioridad y la cadencia
son datos, revisables sin tocar código.

### Negativas / follow-ups
Una fuente que necesite estado entre llamadas (paginación, tokens que caducan)
tendrá que recibirlo por `FetchContext`; se define cuando aparezca.

## Alternativas consideradas

- **Clase base abstracta con lógica común**: acopla; el núcleo de ingesta ya
  hace la parte común (crudo, ids, inserción).
- **Un adaptador por competición en vez de por fuente**: multiplica carpetas;
  la cobertura por competición ya está en el registro.
- **Evaluar la legalidad en código** (robots.txt, ToS): se hizo en la versión
  previa y bloqueó el proyecto; aquí es responsabilidad del titular (D-7).
