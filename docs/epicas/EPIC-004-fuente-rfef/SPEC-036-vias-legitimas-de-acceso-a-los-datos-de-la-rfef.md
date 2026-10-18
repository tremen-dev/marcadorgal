---
id: SPEC-036
tipo: spec
epica: EPIC-004
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-18, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-18, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-18, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-10-18, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-10-18, por: sdd-implementador}
---
# SPEC-036 — Vías legítimas de acceso a los datos de la RFEF

## Problema
La vía de consumo mínimo está agotada: con una identidad, una sesión y 1 POST
por vuelta, la RFEF corta tras **13 peticiones válidas** a 180/120 s y a 300 s
con jitter (SPEC-032, informes `_qa/calibracion/2026-10-17` y `2026-10-18` en
la rama `ft/SPEC-032-calibracion-rfef`). Es un cupo acumulado: un partido de 2 h
pide ~24 a 300 s. Sin otra vía, el `sen sinal` de Tercera y Segunda RFEF sigue
(`_epica.md`, objetivo). El titular pide (2026-10-18) investigar las **vías
legítimas** de obtener datos fiables. Es un **spike**: sin código de producto,
el entregable es un informe para decidir.

## Usuarios / roles afectados
- Titular: hace los contactos externos y decide con el informe.
- Espectador: nada hasta que una vía se convierta en spec de alta.

## Vías y criterio
Común a todas: **sirve** si da, con permiso escrito o licencia, datos de las
competiciones de D-3 (como mínimo Tercera G1 y Segunda RFEF) usables en
marcador.gal; **directo** solo si su latencia es compatible con el criterio 3
de la épica. **No sirve** si exige eludir una protección, no cubre esas
competiciones o supera el coste de H-2.

| # | Vía | Qué se pregunta / a quién | Evidencia esperada |
|---|---|---|---|
| 1 | Acceso autorizado RFEF | Lista blanca de IP o feed/API para medios; condiciones. RFEF, por el correo del titular | Respuesta escrita; nota de ATR que cita «clubes, medios, aficionados y federaciones territoriales» |
| 2 | Novanet (PNFG/ATR) | ¿Licencia o feed para terceros, sobre qué competiciones, con qué permiso de la federación? | Web/comercial de Novanet; respuesta escrita |
| 3 | RFGF (futgal.es) | ¿Feed o acceso para Tercera G1, que organiza con la RFEF? ¿Su app usa la misma plataforma? Lei 1/2016 de Galicia | Web y portal de transparencia RFGF; respuesta escrita |
| 4 | Transparencia | Publicidad activa de la RFEF; ¿cabe una solicitud al CSD por las funciones públicas delegadas (Ley 39/2022)?; resoluciones del CTBG y de la Comisión da Transparencia de Galicia sobre federaciones | Portales y resoluciones citadas por número |
| 5 | Datos abiertos y actas | datos.gob.es, CSD; ¿dónde y cuándo se publican las actas oficiales tras el partido? | Catálogos y páginas de actas; retraso tras el pitido |
| 6 | Proveedores con licencia | ¿Quién tiene los derechos de datos de Primera, Segunda y Tercera Federación (p. ej. RFEF–InStat)? Coste orientativo frente a API-Football | Notas de prensa, webs comerciales, precio publicado o «a consultar» |

## Criterios de aceptación
- **CA-1 Informe y matriz.** Existe
  `docs/epicas/EPIC-004-fuente-rfef/_qa/vias-de-acceso/<fecha>-informe.md` con
  una matriz de **6 filas** (las vías de arriba) y las columnas vía, coste,
  plazo, fiabilidad, latencia esperada, directo / solo finales, estado. Estado ∈
  {`sirve`, `no sirve`, `pendiente de respuesta`, `no comprobable`}, y cada
  estado sale del criterio común (el informe dice cuál de sus condiciones aplica).
- **CA-2 Fuente o motivo.** Cada celda con un dato (no «desconocido») cita al
  menos una fuente con URL y fecha de consulta (ISO). Cada «desconocido» o
  `no comprobable` dice por qué (reto de Cloudflare, precio «a consultar»,
  requiere contacto…). Verificación: recorrer la matriz celda a celda.
- **CA-3 Preguntas listas para el titular.** Para las vías 1, 2 y 3 (y la 4 si
  aplica) el informe trae la lista de preguntas concretas y el destinatario
  institucional (canal público, no datos personales), para que el titular las
  envíe. La spec no envía nada: ninguna vía pasa a `sirve` sin respuesta escrita
  citada.
- **CA-4 Transparencia sin opinión jurídica.** La sección de la vía 4 recoge
  normas, órganos y precedentes (número de resolución, órgano, fecha, URL) y lo
  que dijo cada uno, sin concluir si la RFEF está obligada. La obligación de
  proveer datos queda como **pregunta abierta** (H-3).
- **CA-5 Sin tocar la fuente.** El informe lista los dominios consultados.
  Ninguno es `marcadores.rfef.es` ni un endpoint PNFG de otra federación; si
  `rfef.es` presenta reto de Cloudflare, la celda queda `no comprobable` y se
  cita una fuente secundaria. Cero peticiones automatizadas, proxies o
  navegadores sin cabeza para pasar el reto (ADR-021 §7).
- **CA-6 Recomendación ordenada.** El informe ordena las vías por: da directo >
  fiabilidad oficial > plazo > coste, y para cada una da la siguiente acción, su
  dueño (titular) y la spec que abriría si sirve (alta con feed, corrección de
  finales por actas, cambio de proveedor). No decide: propone.
- **CA-7 Una página.** Matriz, recomendación y preguntas ≤ 80 líneas
  (`wc -l` sin el apéndice de fuentes y dominios). Acaba con las preguntas H-n
  nuevas que salgan de la investigación.
- **CA-8 Sin código.** El diff de la spec no toca `src/`, `supabase/`, `data/`
  ni `tools/` (`git diff --stat origin/main`).

## Entidades y reglas afectadas
Source (`dominio.md`); D-3, D-7; ADR-017, ADR-018, ADR-021 (consumo mínimo)
§5-§7, ADR-020; SPEC-032 (resultado); EPIC-004 Riesgos (acceso
autorizado).

## Fuera de alcance
- Opinión jurídica, redactar o presentar solicitudes de acceso (D-7, titular).
- Enviar correos o llamar: lo hace el titular.
- Esperar las respuestas: la spec cierra con `pendiente de respuesta` donde toque.
- Rotar IP o sesión, proxies, disfraces o eludir Cloudflare (ADR-021 §7).
- Alta de cualquier vía: spec aparte si una sirve.

## Notas para el gate humano
- **H-1 Correo a la RFEF.** *Resuelta por el titular (Alberto Fojo, 2026-10-18):* lo envía el 2026-10-19, sin
  esperar a CA-3, a prensa@rfef.es con CC competiciones@rfef.es; en paralelo, la RFGF.
- **H-2 Techo de coste.** *Resuelta por el titular (Alberto Fojo, 2026-10-18):* sin techo fijo por ahora. El
  informe da el coste orientativo de cada vía y no marca `no sirve` por coste; el
  techo saldrá del estudio de ingresos por patrocinio (fuera de esta spec, sdd-producto).
- **H-3 Obligación de la RFEF.** Según el CTBG, las federaciones están en
  publicidad activa pero no en el derecho de acceso de la Ley 19/2013. La spec no
  la da por hecha. ¿Quieres que el informe solo identifique vías (recomendado), o
  nada de la vía 4? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* solo identificar vías y precedentes.
- **H-4 Navegación manual.** ¿Puedes tú abrir `marcadores.rfef.es` o `rfef.es` a
  mano durante el spike? Reinicia las 24 h de reposo de SPEC-032 (CA-5). *Resuelta por el titular (Alberto Fojo, 2026-10-18):* `rfef.es`
  sí, a mano (otra infraestructura); `marcadores.rfef.es` no, salvo necesidad citada.
- **H-5 Colisión de numeración.** *Resuelta 2026-10-18 (orquestador):* el ADR de
  consumo mínimo RFEF pasa a ADR-021 en la rama SPEC-032 (PR #76).
- **H-6 SPEC-032.** *Resuelta por el titular (Alberto Fojo, 2026-10-18):* se cierra
  con «sin cadencia» y el alta de EPIC-004 espera a esta spec.
