---
id: ADR-017
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-10, por: sdd-arquitecto}
---
# ADR-017: Fuente rfef: panel de marcadores.rfef.es, decodificación cerrada y estados por marca y reloj

- Deciders: sdd-arquitecto propone (2026-10-10) para EPIC-004, aprobada por **Alberto Fojo**, que ya fijó: prioridad 50 que manda también en directo, las cinco competiciones, calendario en API-Football y legal fuera (D-7). **Alberto Fojo (titular) resuelve H-1..H-4 el 2026-10-10** (abajo). Falta la aprobación formal.
- Specs relacionadas: SPEC-031 (adaptador y parser), la spec del motor de EPIC-004 (§8) y las siguientes. **Supersede solo la adyacencia de ADR-009 §5** (§8.1). Evidencia: `EPIC-004/_qa/sondeo/` (2026-10-10, de 20:49Z a 21:47Z) y la serie de campo del 2026-10-11.

## Contexto
`marcadores.rfef.es` es PNFG (Novanet), sin API ni login. Medido: sin cookie,
`NFG_CMP_Paneles` responde 302 a `NLogin`; con la `JSESSIONID` de la portada,
responde 200 a un **GET** con los parámetros en la URL. Con `federacion=3`, una
respuesta (146 KB; 11 KB en gzip; ISO-8859-15) trae las cinco competiciones (el
grupo gallego, donde hay grupos), más Copa y juveniles. Cada grupo lleva `codgrupo`
(Tercera G1 = 26991073). Cada fila lleva «Jornada N», día y hora locales sin año,
y los nombres. Los escudos no sirven para identificar: los filiales usan el del
club. El marcador viene ofuscado con tres técnicas y señuelos `display:none`.
Comprobado:
- `ntype(id,n,i,f)`, empaquetado, pone `fa-<d[i*10+n]>`, y `.fa-N::before` es el
  dígito N en Font Awesome 6.5.1.
- `::before`/`::after` llevan el dígito literal o `\003N`, a veces con
  `display:none`.

La marca naranja (`parpadea`) **no** significa «en juego»: Real Madrid–Villarreal
(kickoff 19:00Z) la seguía teniendo a las 21:47Z. El enlace de la fila varía con
la vista: `verPartido(acta)` en las actas cerradas; `verPartidoEnJuego(acta)` o
nada en las abiertas. **Minuto:** no aparece en ninguna captura del panel. La
ficha `NFG_CmpPartidoEnJuego` tiene una línea de tiempo de eventos que se recarga
por AJAX cada 300 s; en la captura (0-0, ya acabado) estaba vacía. El titular
afirma que la web da el minuto en directo. Queda como **hipótesis por verificar**
con la serie de campo.

## Decisión
1. **Petición.** Por intento: un GET a la portada para la sesión, sin seguir
   redirecciones (la cookie no va al crudo), y **un** GET a
   `NFG_CMP_Paneles?cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3`.
   Charset del `content-type`. Al crudo solo va el segundo. `minIntervalSeconds: 30`.
2. **Identidad.**
   - Grupo → competición por `codgrupo`, en un mapa `competitions` nuevo y
     opcional de `AliasFile` (`data/alias/<temporada>/rfef.json`). Los grupos sin
     mapa se ignoran sin alerta.
   - Equipo: el nombre normalizado (recortado, espacios colapsados, minúsculas,
     NFC) hace de `externalId`.
   - Partido: `(competición, local, visitante)` en el calendario declarado, que
     inyecta el núcleo (ADR-008 §8). «Jornada N» ≠ `round` → `inconsistent_alias`.
3. **Decodificación cerrada.**
   - Se calcula lo que pintaría el navegador (`::before` + texto + `::after`, sin
     `display:none`), sin `eval`: `ntype` se desempaqueta como texto.
   - Solo se aceptan formas conocidas: la función con su forma de hoy, la tabla de
     40 dígitos y lados `^\d{1,2}$`.
   - Si falla cualquier fila, la petición entera va a `requestErrors`: el intento
     sale `ok = false` y no hay ninguna observación. A los 5 min (RN-01) vuelve a
     mandar API-Football.
4. **Estados.** La RFEF nunca emite `scheduled`. Kickoff: el de la fila,
   Europe/Madrid, con el año más próximo a `capturedAt`. Con la serie de campo se
   puede afinar la marca de acta (`verPartido` o `verPartidoEnJuego`).

   | Fila | Observación |
   |---|---|
   | sin marcador (`-`) | ninguna |
   | marcador y `verPartido(acta)` (acta cerrada) | `finished` |
   | marcador sin `parpadea`, `capturedAt ≥ kickoff + 100 min` | `finished` |
   | marcador con `parpadea`, `capturedAt` en `[kickoff − 10, kickoff + 110)` | `live` (minuto: §8.2) |
   | marcador en cualquier otro caso | `skipped: ambiguous_state` (motivo nuevo) |
   | «Aplazado» | `postponed` |
   | «Suspendido», con o sin marcador | `suspended` (§8.3) |
   | otro texto | `skipped: unsupported_status` |
5. **Prioridad 50** en las cinco competiciones. Con ella, `settle` ya da `confirmado`.
6. **Crudo antes que parseo** (ADR-007 §6): ~11 MB/día en gzip a 1.000 ticks.
7. **Fixtures y oráculo.** Capturas reales. Playwright pinta cada fixture sin red,
   con `.fa-N` en línea, y el texto visible de cada marcador tiene que ser el del
   parser.
8. **Motor (spec propia de EPIC-004, antes del alta).**
   1. **RN-04 por bandas:** solo son adyacentes las fuentes de la misma banda
      (1-49 proveedores, 50-99 federación). Entre bandas manda RN-01: no hay
      retención ni alerta, y el informe de jornada cuenta las discrepancias.
   2. **Minuto:** si la RFEF lo da, se usa. Si la ganadora da `live` con
      `minute: null`, se publica el minuto de la observación fresca más
      prioritaria que lo tenga; el marcador y el estado siguen siendo de la
      ganadora.
   3. **`suspended` sin marcador:** en el modelo, `suspended` admite `score: null`.
      El motor, si la ganadora es `suspended` sin marcador, publica `suspended`
      con el marcador de la Decision vigente (o `null`, si no hay). *Por qué:* la
      RFEF manda en el estado, y el marcador que ya se conoce es el único que no
      se inventa. Para `postponed` no cambia nada: ya va sin marcador y la RFEF
      lo impone.

## Consecuencias
### Positivas
Una petición de datos por tick cubre las cinco competiciones. Si la ofuscación
cambia, la fuente falla de forma visible (`tick:salud`), nunca con un dígito
falso. Si la RFEF calla, manda API-Football.
### Negativas / follow-ups
- Con 50, la latencia del gol es la de la RFEF aunque API-Football vaya antes.
- **Reloj de la RFEF:** su cabecera `Date` iba ~124 s por delante del reloj local
  (21:53:24Z frente a 21:51:20Z). La latencia se mide solo con los relojes de
  ADR-016. `Date`, «Última actualización» y las horas de la página no se usan sin
  corregir el desfase, y las juntas lo declaran (ADR-016 §5).
- `parpadea`, la marca de acta y el minuto salen de una noche de capturas. SPEC-031
  no cierra la tabla de §4 sin la serie de campo.
- §8.3 toca el modelo (`MatchState`, el check de `decisions`) y la interfaz
  («Suspendido» sin marcador). Hasta que se implemente, el parser deja «Suspendido»
  sin marcador en `skipped: suspended_without_score`.

## Alternativas consideradas
- **Ficha por partido**: 530 KB y una petición por partido.
- **`Sch_en_juego=1`** (23 KB): no trae actas cerradas.
- **Ejecutar el JS** (sandbox o headless): mete código ajeno en el tick y acepta
  en silencio cualquier ofuscación nueva.
- **Escudo como identidad**: lo comparten los filiales.
- **`parpadea` → `live` sin reloj**: deja partidos acabados en juego hasta el
  cierre forzoso.
- **§8.3 con el marcador de otra fuente**: con 50, el marcador sería de una fuente
  de 10. **Callar** (la propuesta original de H-3): rechazado por el titular.

## Decidido por el titular (Alberto Fojo, 2026-10-10)
- **H-1 Sí**, minuto prestado. El titular afirma que la RFEF da el minuto en
  directo: si se confirma, se usa el suyo (§8.2).
- **H-2 Sí**, adyacencia por bandas, sin retención ni alerta entre bandas, con
  las discrepancias en el informe (§8.1). Supersede solo ADR-009 §5.
- **H-3 No a que la RFEF calle**: «La rfef tiene que mandar en cualquier caso por
  su peso, así que tiene que mandar también en los suspendidos». Queda §8.3; lo
  mismo para `postponed`.
- **H-4 Sí.** Serie de campo del 2026-10-11, de 09:30Z a 20:00Z, cada 2 min, en las
  dos variantes (todos y `Sch_en_juego=1`), fuera del repo.
