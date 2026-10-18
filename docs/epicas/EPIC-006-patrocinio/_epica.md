---
id: EPIC-006
tipo: epica
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-10-18, por: sdd-producto}
---
# EPIC-006 — Modelo de ingresos: patrocinio

## Objetivo
Saber cuánto puede gastar el proyecto en datos. SPEC-036 (vías de acceso a la
RFEF) puede acabar en un proveedor de pago y no hay techo de coste: hoy la
plataforma cuesta ≈ 64 $/mes sin ingresos (`contexto.md`). El titular quiere
que el techo salga de lo que pagaría un patrocinador gallego (GADIS, Froiz,
Abanca, Estrella Galicia…) por una jornada o una temporada (titular,
2026-10-18). El primer entregable es un **estudio de mercado, spike sin
código**. Condiciona el modelo un no-negociable de FOUNDATION: **sin cookies,
sin analítica de terceros, sin datos de quien mira**. Por eso solo cabe
patrocinio directo y contextual, sin publicidad programática ni segmentación.

## Criterios de éxito
1. **Comparables con fuente.** Al menos 8 cifras citadas (CPM y tarifas de
   patrocinio en medios deportivos regionales, secciones de resultados de
   prensa gallega, apps de resultados). Cada cifra lleva fuente y fecha; lo
   que no la tenga se marca como hipótesis.
2. **Audiencia con número.** Línea base de visitas por jornada (sábado y
   domingo) medida sin violar el no-negociable, o la declaración explícita de
   que no existe y desde qué jornada existirá. Una proyección a una temporada
   con supuestos escritos.
3. **Precio por formato.** Rango bajo, medio y alto en € para al menos dos
   formatos: jornada patrocinada y competición patrocinada por temporada.
   Cada formato es compatible con `docs/diseno/` (D-8) o nombra la excepción
   de ADR-005 que necesitaría.
4. **Techo de coste mensual para datos**, en €, con una fórmula reproducible
   (ingreso del escenario bajo, menos plataforma, por el margen que fije el
   titular) que el titular acepte y que SPEC-036 pueda usar tal cual.

## Alcance
- Dentro: estudio de comparables; medición o plan de medición de audiencia;
  catálogo de formatos con boceto en palabras (dónde, qué texto, gl/es);
  fórmula ingreso → techo; ficha de una página con la oferta para que el
  titular la lleve a las marcas.
- Fuera (aparcado a propósito, no por descuido):
  - Contactar, negociar o firmar con marcas: lo hace el titular.
  - Pintar el patrocinio en la pantalla. Será otra épica cuando haya un
    acuerdo firmado (criterio de corte del roadmap).
  - Publicidad programática, redes de anuncios y cualquier formato que
    necesite cookies o datos de quien mira (no-negociable).
  - Otras vías de ingreso: donaciones, suscripción, licencia del feed o
    widget para medios. Se anotan si aparecen, no se estudian.
  - Facturación, fiscalidad y legalidad de cada categoría de anunciante
    (las lleva el titular, como D-7 con las fuentes).
  - Elegir proveedor de datos: es SPEC-036 y el ADR que salga de ella.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->
Desglose orientativo (lo autora sdd-arquitecto): spike del estudio de mercado
(comparables, formatos, fórmula y ficha); si H-1 lo pide, medición de
audiencia compatible con el no-negociable.

## Riesgos
- **Audiencia pequeña o sin medir.** Con poco tráfico el techo puede salir
  cercano a cero. Es un resultado válido y se declara así.
- **Identidad.** `vision.md`: «No un medio». Un patrocinio visible puede
  chocar con la pantalla sin ruido y con lo gallego arriba (H-2).
- **Medición limitada por diseño.** Sin analítica de terceros, la audiencia
  sale de cifras agregadas del servidor, más pobres que las que piden las
  marcas.
- **Dependencia de una sola marca.** Si el techo se apoya en un patrocinador,
  el proveedor de datos queda expuesto a que no renueve.
- **Comparables de medios generalistas.** Los CPM de prensa sobrestiman a un
  marcador de nicho. Se usa el escenario bajo.

## Preguntas para el titular
- **H-1. Audiencia.** ¿Hay datos (Vercel Analytics, logs de Vercel)?
  ¿Cuentas Vercel Analytics como «analítica de terceros» del no-negociable?
  Si la cuentas, la audiencia sale solo de peticiones agregadas. *Resuelta por el titular (Alberto Fojo, 2026-10-18):* sí cuenta; la
  audiencia sale solo de peticiones agregadas (logs de Vercel), sin Vercel Analytics.
- **H-2. Identidad.** ¿Encaja el patrocinio con «No un medio»? ¿Lo quieres
  dentro de la pantalla Xornada o solo en un pie o una página aparte? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* sitio
  importante dentro de Xornada, tras unos ajustes previos de la pantalla (spec aparte).
- **H-3. Categorías.** Recomiendo **excluir las apuestas**: `vision.md` dice
  «No una app de apuestas», FOUNDATION las deja fuera y su publicidad está
  muy restringida. ¿Aceptas el alcohol? ¿Solo cerveza (Estrella Galicia) o
  ninguno? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* apuestas fuera;
  se admite cualquier alcohol legal (la base legal, D-7, la lleva el titular).
- **H-4. Marca en pantalla.** D-8 prohíbe escudos. ¿El patrocinador sale
  como texto en galego («Xornada con…») o admites su logotipo como excepción
  de ADR-005? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* se admite
  cualquier logotipo; «sin escudos» (ADR-005) se refiere solo a los de los equipos.
- **H-5. Qué cubre el techo.** ¿Cubre solo datos o también la plataforma
  (≈ 64 $/mes)? ¿Qué déficit mensual aceptas mientras no haya ingresos? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* patrocinio
  por jornada; el suelo es un cuarto del coste mensual de datos y plataforma
  (≈ 20 €/jornada). Más adelante, precio mayor para jornadas finales, playoff, etc.
- **H-6. Momento.** ¿El estudio debe estar antes de que cierre SPEC-036 (y
  entonces se adelanta al código de EPIC-005) o puede esperar? *Resuelta por el titular (Alberto Fojo, 2026-10-18):* ahora, sin
  código, mientras se espera la respuesta de la RFEF.
