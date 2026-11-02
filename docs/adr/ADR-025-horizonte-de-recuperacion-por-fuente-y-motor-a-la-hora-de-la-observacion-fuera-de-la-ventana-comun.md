---
id: ADR-025
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-02, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-025: Horizonte de recuperación por fuente y motor a la hora de la observación fuera de la ventana común

- Deciders: sdd-arquitecto propone (2026-11-02) a encargo del orquestador por el daño del 2026-11-02. **Alberto Fojo (titular)** decide H-1..H-8 de SPEC-044 en el gate y aprueba.
- Specs relacionadas: SPEC-044 (lo ejecuta); SPEC-038 CA-6 (filtro de fuera de ventana, que sigue para lo que queda fuera del horizonte); SPEC-039 (mide la primera jornada con horizonte). **Precisa, sin superseder:** ADR-002 §2 y ADR-013 §1 (la ventana gana un horizonte **por fuente**); ADR-008 §7 y ADR-009 §1 (el `now` del motor para lo que llega fuera de la ventana común); ADR-023 §5 (el descarte de fuera de ventana se aplica a lo que queda fuera del horizonte); ADR-019 (sin excepción nueva: todo pasa por `decideMatches`). Enmienda la letra de **Ventana** (`dominio.md`) y añade una nota a **RN-08**.

## Contexto
La jornada 2026-10-30/11-02 se jugó sin datos de API-Football (sin plan de pago esa semana). El 2026-11-02 por la mañana `/api/board` da 49 partidos: 9 `finished provisional` y **39 `scheduled` ya jugados** (Tercera 9, Segunda 11, Primera 7 de 8, Primera RFEF 6 de 10, Segunda RFEF 6 de 9). La rfef vía explorer (ADR-023, SPEC-038) **tiene esos finales**: el export desplegado trae 25 `FINISHED` del 10-31 y 35 `FINISHED` + 1 `POSTPONED` del 11-01, todos con `lastSeenAt` 2026-11-01T22:58:41Z (`src/sources/rfef/fixtures/export/`). No entran por tres cerrojos, los tres a propósito: el tick solo pregunta por partidos en ventana (ADR-002 §2, hasta +6 h sin directo por ADR-013), SPEC-038 CA-6 descarta las observaciones de fuera de ventana, y RN-01 solo cuenta observaciones con menos de 5 min de edad **por `observedAt`** (reloj de la fuente): con `lastSeenAt` del domingo y `now` del lunes, una observación aceptada tampoco ganaría nada. El motor sí admite `finished` sobre `scheduled` (ADR-013, SPEC-018 CA-4 (iv)). Ya hubo dos reconciliaciones «únicas» del mismo patrón (SPEC-013 CA-6, SPEC-018 CA-7); la tercera es una regla.

## Decisión
1. **Horizonte de recuperación por fuente.** Cada fuente `pull` puede declarar un horizonte en horas desde el kickoff. `rfef`: **72 h** (H-1). Las demás: 0 (API-Football no paga peticiones `ids=` de tres días; su silencio lo cubre el cierre forzoso). Vive en `src/ingest/constants.ts` (`RECOVERY_HORIZON_HOURS`, por `SourceId`) mientras SPEC-044 no toque `src/model` (H-5): un test exige que cada clave sea una fuente del registro.
2. **Conjunto recuperable.** Un partido está «en recuperación» para una fuente a `now` si **no** está en la ventana común, `kickoff ≤ now < kickoff + horizonte`, y su Decision vigente no lo cierra: sin Decision, o cualquier estado salvo `finished` sin marca de cierre forzoso. Es la mitad «por Decision» de `isInWindow`, idéntica, sin añadir estados (H-3: un `finished` con marca entra y RN-12 lo reconcilia, ADR-010 §2).
3. **Fuera de la ventana común solo se escuchan estados finales.** De un partido en recuperación entran `finished`, `postponed` y `suspended`; un `live` se descarta y se cuenta (`details.recuperacion.descartadasLive`): publicar un `live` del domingo el lunes dejaría un partido en juego que ningún barrido cerraría.
4. **El motor corre a la hora de la observación.** Para las observaciones de partidos en recuperación, el enganche `afterInsert` ejecuta `decideMatches` con **`now` = `observedAt`** de la observación (una llamada por instante distinto, ascendente), dentro de la misma transacción y tras un único `lockMatches` sobre todos los ids en orden de id (ADR-019 §1, §5). Es lo que hace el replay (SPEC-012, `src/decide/replay.ts`): el motor puro no cambia y RN-01 se evalúa con el reloj de la fuente, que es el que RN-11 muestra. `decided_at` = ese `now` (ADR-019 §3: no promete orden; el orden lo dan `version` y `recorded_at`). Los tres relojes siguen sin mezclarse (D-9).
5. **Ritmo y coste.** Los partidos en recuperación de una fuente entran en su intento solo si su último intento con recuperación (`ingest_attempts.details.recuperacion`, buscado en la última hora) tiene ≥ `RECOVERY_POLL_MINUTES` = 5 min, o no hay ninguno. El adaptador de explorer ya hace **un GET por fecha Europe/Madrid** entre los kickoffs que recibe: 60 partidos de tres días cuestan tres GET, en una sola captura y un solo objeto crudo. Una observación de recuperación idéntica a la última guardada de esa fuente para ese partido (`observedAt`, estado, marcador) no se inserta: explorer repite el mismo `lastSeenAt` hasta releer la fila. El barrido (RN-05, cierre forzoso) no ve el conjunto recuperable.
6. **Recuperación manual más allá del horizonte.** `npm run rfef:recuperar -- --desde <fecha> --hasta <fecha> [--dry-run]` hace lo mismo que §2-§5 para los partidos declarados de esas fechas, sin horizonte, con un intento y un crudo como cualquier tick, y **solo contra explorer** (un servicio propio que sirve lo que ya tiene en Postgres, ADR-023 §3): ninguna petición a `marcadores.rfef.es`. Es un camino, no una excepción: cada ejecución la lanza una persona y deja su rastro. Para un partido cerrado (`finished` sin marca) la herramienta guarda la observación y, si el marcador discrepa, abre **una** alerta `conflict`; nunca escribe una Decision por él (RN-04, ADR-011).
7. **Letras nuevas.** **Ventana** (`dominio.md`): «[…] con sondeo cada 5 min. Una fuente con horizonte de recuperación sigue consultando, cada 5 min y solo para estados finales, los partidos que su Decision no cierra hasta kickoff + horizonte (72 h la rfef).» **RN-08** gana la nota «*Precisada el <fecha> por ADR-025: la ventana de una fuente es la común más su horizonte de recuperación; la recuperación manual contra un servicio propio deja intento y crudo.*» Su letra no cambia.

## Consecuencias
### Positivas
Un apagón de API-Football o una caída de explorer de una tarde se recuperan solos en el siguiente intento con recuperación, sin operador. La jornada 2026-10-30/11-02 se repara con la herramienta de §6 y queda con intento, crudo y observaciones como cualquier otra. El motor puro y RN-01 no cambian; la rfef sigue publicando `provisional` con prioridad 5 (ADR-023 §1).
### Negativas / follow-ups
- Las Decisions recuperadas llevan `decided_at` del domingo y `recorded_at` del lunes: `informe:jornada` cuenta los `decided_at` invertidos (ADR-019 §4) y los verá; SPEC-039 los explica.
- Un `postponed` recuperado sigue «abierto por Decision» 72 h: cada 5 min un GET por su fecha y 0 observaciones nuevas por la identidad de §5. Coste acotado, no nulo.
- El horizonte vive en una constante, no en el registro (H-5): moverlo a `SourceConfig` es una entrada de EPIC-MANT.
- Si explorer deja de releer las filas de días anteriores, `lastSeenAt` no se refresca y la observación recuperada es la misma: correcto, pero una Decision que el motor ya publicó a ese instante no se repite (ADR-009 §2).

## Alternativas consideradas
- **`observedAt` = `exportedAt` de la captura**: declararía como reloj de la fuente el de nuestra petición (RN-11, D-9) y contradice ADR-023 §5; un espectador leería «hace 1 min» en un dato del domingo.
- **Ampliar la ventana de RN-01 o tocar `src/decide/`**: cambia la regla para todas las fuentes y rompe la pureza por un caso de ingesta.
- **Horizonte global** (subir `EXTENSION_AFTER_MINUTES` a 72 h): API-Football pagaría `ids=` tres días por partido y el barrido correría RN-05 sobre todos.
- **Tercera reconciliación única** (SPEC-013 CA-6, SPEC-018 CA-7): EPIC-FIX pide el arreglo que se queda; además aquellas pedían una observación fresca, que explorer no puede dar.
- **Ritmo por última observación** (como la prórroga, ADR-013 H-2): una fila `SCHEDULED` de explorer no da observación y el partido se preguntaría cada tick 72 h.
- **Push desde explorer**: EPIC-005.
- **Ejecutar el tick con un `now` falso**: es escribir a mano con otro nombre.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
