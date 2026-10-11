---
id: ADR-018
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-11, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-018: Fuente rfef: el panel por POST, cuerpo vacío como error y respuesta rancia

- Deciders: sdd-arquitecto propone (2026-10-11) a partir del hallazgo de campo del orquestador (2026-10-11, ~15:00Z). Aprobado por **Alberto Fojo** el 2026-10-11, con §4 como error que corta (una repetición basta) y la condición de §5 aceptada.
- Specs relacionadas: SPEC-031 (enmienda E-1: CA-7, CA-1, CA-5) y la spec de alta de EPIC-004 (§4). **Supersede solo ADR-017 §1** (la petición de datos) y deja en revisión la evidencia de ADR-017 §4. Evidencia: `<scratchpad>/campo-2026-10-11/` (serie GET) y `<scratchpad>/campo-2026-10-11-post/` (serie POST), fuera del repo.

## Contexto
La serie de campo por GET (09:30Z–14:58Z, cada 2 min, misma query de ADR-017 §1):
- **`todos`**: 33 cuerpos no vacíos, **todos** con el mismo md5 `9618ec16…`
  (147.490 B), la foto del sábado 21:53Z, con los partidos del domingo sin jugar.
  Los otros **129** fueron `200` con `Content-Length: 0`, en rachas de hasta 40.
- **`Sch_en_juego=1`**: 33 iguales, md5 `5389dcc4…`, idéntico byte a byte al
  fixture `paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z.raw` del sondeo.
  Llevaba más de 17 h congelado.
- **Fichas** (`NFG_CmpPartidoEnJuego`, por GET): 7 de 7 idénticas.

Prueba controlada a las 15:00Z, con la misma sesión y la misma query. Por GET
vuelve la foto del sábado. Por **POST, con la query en el cuerpo**, llegan
cuerpos frescos y distintos en cada petición (165.352 y 165.707 B en el mismo
minuto). El UA no influye. La serie POST (desde 15:00Z) sigue igual: 3 de 3
`todos` y 3 de 3 `enjuego` con md5 distintos. El parser de SPEC-031 los lee
sin error (68 filas, 50 con marcador). En las dos variantes llega
`Cache-Control: private, max-age=300`, así que la cabecera no permite
distinguirlas. La portada pide el panel con `Nova_Ajax(…, 'cod_primaria=…&'+parametros, …)`
(los parámetros van aparte de la URL; que sea POST no está verificado en su JS).

Hay un dato que hace detectable la caché: **la ofuscación se rehace en cada
respuesta**, con ids, señuelos y tamaño distintos. Una respuesta fresca no
repite bytes. Dos respuestas idénticas indican que salen de una caché.

## Decisión
1. **Petición** (sustituye ADR-017 §1). *2026-10-11, supersedido en parte por
   ADR-019:* número y variante de peticiones por intento; el POST no cambia. Por intento: el GET a la portada para la
   sesión, igual que antes, y **un POST** a `…/NPcd/NFG_CMP_Paneles`, sin query en la
   URL. El cuerpo es la query de ADR-017 §1, sin cambios, con
   `Content-Type: application/x-www-form-urlencoded`, `Cookie` y el UA del
   registro. `redirect: "manual"`, charset y `minIntervalSeconds: 30` no cambian.
2. **Crudo.** `RawRequest` gana dos campos **opcionales**: `method` (`"GET"` por
   omisión; la rfef escribe `"POST"`) y `requestBody` (el cuerpo enviado, tal
   cual). `url` es la URL de verdad, sin query. Ni la cookie ni ninguna cabecera
   de la petición van al crudo. Las capturas que ya existen (api-football,
   bucket `raw`) siguen validando sin tocarlas.
3. **Cuerpo vacío = error visible.** Un `200` con cuerpo vacío no hace lanzar a
   `fetch`: va al crudo, para que quede la evidencia de la racha, y `parse` lo
   devuelve en `requestErrors` con el motivo `empty body`. El intento sale con
   `ok = false`, cero observaciones y `tick:salud` en FALLO. A los 5 min manda
   API-Football (RN-01), como en ADR-017 §3.
4. **Respuesta rancia** (la implementa la spec de alta, en el núcleo, porque
   `parse` es puro y solo ve una captura). Si el cuerpo de la petición de datos
   es **byte a byte igual** al del intento anterior de la rfef (sha-256 en
   `ingest_attempts.details`), se trata como `requestErrors: stale body`, con
   cero observaciones. Basta con una repetición. Sin este detector no hay alta.
5. **Condición.** §4 se apoya en que la ofuscación no se repite nunca. Si en la
   serie POST completa (15:00Z–20:00Z) se repite algún md5 de `todos` o de
   `enjuego`, este ADR vuelve al gate (aprobado con esta condición el 2026-10-11).

## Sobre ADR-017 §4 (la evidencia queda en revisión)
- **Se mantiene:** `parpadea` ≠ en juego. No depende de la caché, porque en un
  mismo cuerpo (21:25:36Z) Mirandés–Zamora lleva `parpadea` y
  `verPartidoEnJuego` junto a «Última actualización 22:54 h. (Final de partido)».
- **No fiable:** Real Madrid–Villarreal con `parpadea` a kickoff+167. El sondeo
  usó GET y no hay forma de demostrar que esa respuesta fuera fresca.
- **Hay que resolverlo con la serie POST** (CA-1 de SPEC-031): una tabla, por
  partido de Segunda o Tercera Federación, con la hora, el marcador, `parpadea`,
  el enlace (`verPartido`/`verPartidoEnJuego`) y el texto «Última actualización
  … (min N | Inicio de partido | Final de partido)». Con ella se fijan los
  umbrales +100/+110 y se decide si «(Final de partido)» sirve como marca de
  `finished`. Ese texto no estaba en la tabla de §4. El «(min N)» es el minuto
  **del último evento**, no el minuto en curso. Por sí solo no cumple ADR-017
  §8.2.

## Consecuencias
### Positivas
El tick lee datos frescos. El vacío y la caché fallan de forma visible y nunca
dejan un marcador congelado con prioridad 50.
### Negativas / follow-ups
- Toca `src/model` (dos campos opcionales) y el `fetch` ya implementado de SPEC-031.
- Las fichas de la serie POST siguen pidiéndose por GET: no sirven como evidencia
  del minuto mientras no se pidan por POST.
- Si la RFEF devuelve vacíos en rachas también por POST, la rfef dejará huecos.
  Lo medirá la serie y lo contará el informe de jornada.

## Alternativas consideradas
- **GET con un parámetro que rompa la caché** (`&_=<ts>`): inventa un parámetro
  que la RFEF no documenta. Además no está medido, y el POST sí.
- **La query en `url` con `method: POST`**: el crudo describiría mal lo que se envió.
- **Lanzar en `fetch` ante el vacío**: se pierde el crudo y, con él, la medida de las rachas.
- **Detectar la caché por la cabecera `Date` o por «Última actualización»**: la
  `Date` era fresca en las respuestas rancias. El sello solo cambia cuando hay un
  evento, y un partido tranquilo parecería rancio.
- **Solo un aviso en `tick:salud`, sin `requestErrors`**: un gol congelado con
  prioridad 50 tapa el de API-Football.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
