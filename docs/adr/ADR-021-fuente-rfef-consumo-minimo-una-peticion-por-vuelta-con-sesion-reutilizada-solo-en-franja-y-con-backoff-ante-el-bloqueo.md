---
id: ADR-021
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-11, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-021: Fuente rfef: consumo mínimo, una petición por vuelta con sesión reutilizada, solo en franja y con backoff ante el bloqueo

> Renumerado el 2026-10-18 (antes ADR-019 en la rama de SPEC-032): main ya tenía ADR-019 (motor serializado por partido, SPEC-035).

- Deciders: sdd-arquitecto propone (2026-10-11) a encargo del orquestador, tras el bloqueo por IP de la serie de campo (F-SPEC-031-9). Aprobado por **Alberto Fojo** el 2026-10-11, con H-1..H-4 de SPEC-032 resueltas allí.
- Specs relacionadas: SPEC-032 (calibración: mide la cadencia de §5 con el patrón de §1-§2) y la spec de alta de EPIC-004 (lo implementa). **Supersede solo ADR-018 §1** en el número y la variante de las peticiones por intento. El POST, su cuerpo y el crudo (ADR-018 §1-§2) no cambian; ADR-018 §3-§5 siguen en vigor.

## Contexto
La RFEF bloquea por IP tras unas 5 vueltas (~10 min) de consultas automáticas:
`200` con `Content-Length: 0` a todo, portada incluida, con bloqueos crecientes
(8 → 16 → 30 → 50 → 76 → más de 80 min; F-SPEC-031-9). Cada vuelta de aquella
serie hacía de 3 a 6 peticiones cada 2 min: portada nueva (sesión nueva), panel
`todos` (~165 KB), panel `Sch_en_juego=1` (~40 KB) y hasta tres fichas de
~480 KB. **No medimos el umbral: lo pisamos.** ADR-018 §1 pide 2 peticiones por
intento cada 30 s (~4/min): más que la serie que provocó el bloqueo.

## Decisión
1. **Una petición por vuelta.** *2026-10-12, supersedido en parte por ADR-020
   (borrador, pendiente del titular):* la apertura de sesión es portada + `NLogin`,
   la renovación es apertura + un reintento y el tope por vuelta es 3 al abrir y
   4 al renovar. La `JSESSIONID` se reutiliza mientras valga. La
   guarda el núcleo, fuera del crudo, en un almacén privado del servidor; el
   adaptador la recibe en el contexto y devuelve la renovada fuera de la
   captura (cambio de contexto de ADR-003, en la spec de alta). Se renueva solo
   si el POST responde 3xx o `NLogin`/«No se ha aceptado el cookie»: un GET a la
   portada y **un** reintento del POST. Nunca más de 3 peticiones por intento.
2. **Variante.** Vuelta normal: solo el panel `Sch_en_juego=1` (cuerpo de
   ADR-018 §1 + `&Sch_en_juego=1`). Panel `todos` (trae las actas cerradas)
   solo en la **apertura** de una franja (su primer intento en ventana) y en su
   **cierre** (primer intento con la franja a kickoff + 110 min, fin de `live` en
   ADR-017 §4). *Franja* = partidos de las cinco competiciones con el mismo
   kickoff. Si en un intento coinciden varias aperturas o cierres, un `todos`
   las cubre.
3. **Solo dentro de ventana** (ADR-002 §2, ADR-008 §4): fuera, cero peticiones.
   **Alcance (H-2 de SPEC-032):** (a) todas las franjas, o (b) solo las franjas
   con algún partido sin directo de API-Football (`sen sinal`, ADR-013), más el
   `todos` de cierre de cada franja para corregir finales. Una vuelta cuesta lo
   mismo en ambas (un panel cubre todos los partidos); (b) reduce vueltas.
4. **Backoff ante el bloqueo.** Tras `n` intentos rfef seguidos con `empty body`
   (ADR-018 §3), el siguiente no empieza antes de `started_at` del último +
   `min(8 · 2^(n−1), 120)` min. Se calcula de `ingest_attempts`; el adaptador no
   lee reloj. Sin reintentos dentro del intento. Un cuerpo no vacío (aunque sea
   rancio, ADR-018 §4) pone `n = 0`. Durante el backoff no hay intento rfef;
   RN-01 da el mando a API-Football a los 5 min y `tick:salud` muestra «rfef en
   backoff hasta <instante>».
5. **Cadencia.** `minIntervalSeconds` de la rfef = cadencia recomendada por
   SPEC-032, no 30 s. Sin calibración, no hay alta.
6. **Identidad estable y declarada.** En producción, una **IP de salida
   estática de Vercel** (función fijada a su región) y el UA del registro,
   `marcador.gal (ingesta; https://marcador.gal)`. Plan, región y coste los
   decide la spec de alta.
7. **Fuera, sin excepción:** rotar o renovar IP, proxies, varios orígenes,
   variar el UA o cualquier técnica para no ser identificados o eludir el
   bloqueo. Si la cadencia no basta, el camino es el acceso autorizado
   (`_epica.md`, Riesgos).

## Consecuencias
### Positivas
De 3-6 peticiones por vuelta a 1, y de ~165 KB a ~40 KB. La fuente solo consume
en ventana y retrocede sola ante el bloqueo, que nunca deja un marcador con
prioridad 50: manda API-Football (ADR-018 §3, RN-01).
### Negativas / follow-ups
- La sesión es estado entre ticks: almacén nuevo y cambio del contexto de
  ADR-003. Lo guarda el núcleo, porque la fuente no escribe (D-5).
- No se sabe si un partido acabado sigue en `Sch_en_juego=1` (no hubo final en
  la serie). El `todos` de cierre lo cubre; un final no visto en directo puede
  llegar hasta ~10 min tarde (k+110 frente a k+~100).
- El minuto (ficha, F-SPEC-031-2) queda fuera: ~480 KB por partido y vuelta.

## Alternativas consideradas
- **Panel `todos` en cada vuelta**: 4× más bytes; no sabemos si el bloqueo
  cuenta peticiones o bytes.
- **Sesión nueva por vuelta** (ADR-018 §1): duplica las peticiones; abrir
  sesiones en serie es lo más parecido a un robot que hacemos.
- **Reintento inmediato ante el vacío**: alarga un bloqueo que crece con la
  insistencia.
- **Rotación de IP o proxies**: eludir una protección deliberada de la fuente.
  Rechazado por el titular (`_epica.md`, Riesgos).

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
