---
id: EPIC-003
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-06, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-10-06, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-003 — Xornada pública

## Objetivo
Que el público vea la jornada. EPIC-002 deja un marcador correcto y trazable
en `board` (39/39 en la jornada medida; los partidos sin directo cierran
solos desde SPEC-018), pero nadie lo ve. Esta épica pone en marcador.gal la
pantalla **Xornada** de `docs/diseno/` (D-8): las cinco competiciones de D-3
en una pantalla, en directo, en galego y con castellano en `/es` (D-2). Va
antes que EPIC-004 por decisión del titular (2026-10-06): el dato ya es
correcto y tres de las cinco métricas norte solo se miden con pantalla.

## Criterios de éxito
1. **Una jornada real publicada en `marcador.gal`**: un fin de semana completo
   de las cinco competiciones servido al público en el dominio, sin
   intervención manual en la pantalla.
2. **Lo que se pinta es lo que dice `board`**: en esa jornada, ningún partido
   muestra un marcador o estado distinto de su Decision vigente más allá del
   retraso de entrega del criterio 3 (contraste muestreado, con evidencia).
3. **Latencia gol → pantalla medida** (mediana y p95) con mejor referencia
   que la de SPEC-009 (R-SPEC-009-6) y desglosada con un segundo reloj
   (R-SPEC-009-7). Objetivo de `vision.md`: mediana < 45 s, p95 < 90 s. Si no
   se alcanza, la épica cierra con la decisión escrita del titular: cambiar
   objetivo, cadencia o fuente.
4. **Primera pintura en móvil con 3G < 2 s**, con el dato ya en el HTML
   (snapshot servido), medida en la jornada del criterio 1.
5. **Frescura honesta (D-9)**: si Realtime cae, la pantalla sigue por
   polling y dice cuándo se actualizó; un fallo de transporte nunca se pinta
   como estado del partido. `sen sinal` se ve como estado propio, nunca solo
   con color.
6. **Las cinco competiciones producen Decisions** antes de cerrar
   (pendiente de EPIC-002, criterio 5): incluida Primera División.

## Alcance
- Dentro: pantalla Xornada en móvil y escritorio según `docs/diseno/`;
  snapshot servido en la primera respuesta; Realtime con fallback a polling;
  tira de días; filtros por competición; indicador de frescura; gl/es vía
  i18n; estados `scheduled`, `live` (con descanso), `finished`, `postponed`,
  `suspended` y el cualificador `sen sinal`; medición de latencia y primera
  pintura.
- Fuera (aparcado a propósito, no por descuido):
  - Operador, panel y segunda fuente: EPIC-004. El directo que la fuente no
    da en Tercera y Segunda RFEF se ve como `sen sinal`, no se arregla aquí.
  - Detalle de partido, eventos, clasificaciones, favoritos, notificaciones,
    feed para medios: «Más adelante».
  - Cuentas de usuario y modo claro (D-8: solo modo oscuro).
  - Escudos de clubes (D-8).
  - Cambiar el motor o las reglas: si la pantalla destapa un fallo del dato,
    va a EPIC-FIX.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo (lo autora sdd-arquitecto): lectura pública de `board`
y snapshot; pantalla Xornada móvil; escritorio y tira de días; Realtime,
fallback y frescura; medición de latencia y primera pintura; jornada
publicada.

## Riesgos
- **Entorno.** Todo corre hoy sobre Supabase `dev`. Publicar al público
  puede exigir separar entorno o endurecer acceso (RLS, ADR-006): decisión
  técnica de sdd-arquitecto, ADR antes de la primera spec que exponga datos.
- **Latencia.** La mediana medida fue +53 s (n = 15, referencia a minuto):
  puede que el objetivo de 45 s no sea alcanzable con la cadencia actual.
  *Hipótesis a validar* en la jornada del 2026-10-09/12.
- **Directo de Tercera.** La fuente no dio en directo 4 de 8 partidos en J5:
  la promesa «en directo de verdad» no se cumple en el nicho hasta EPIC-004.
  La pantalla debe decirlo con `sen sinal`, no esconderlo.
- **Coste de Realtime** con público real: sin medir.
