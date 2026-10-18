---
id: SPEC-037
tipo: spec
epica: EPIC-006
estado: aprobada
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-18, por: Alberto Fojo}
---
# SPEC-037 — Estudio de mercado del patrocinio por jornada

## Problema
La plataforma cuesta ≈ 64 $/mes sin ingresos (`contexto.md`, Riesgos) y
SPEC-036 puede acabar en un proveedor de pago sin techo de coste. El titular
vende el patrocinio **por jornada** y fija el suelo (EPIC-006 H-5): un cuarto
del coste mensual de datos y plataforma, **≈ 20 €/jornada**. A medio plazo
quiere dejar de pagar API-Football. Es un **spike sin código**: el entregable
es un informe que diga si el mercado sostiene ese suelo y a qué precio, y una
ficha para que el titular la lleve a las marcas. El no-negociable de
FOUNDATION manda: sin cookies, sin analítica de terceros, sin datos de quien
mira. Vercel Analytics cuenta como analítica de terceros (H-1).

## Usuarios / roles afectados
- Titular: decide el precio y lleva la ficha a las marcas (GADIS, Froiz,
  Abanca, Estrella Galicia…).
- Espectador: nada hasta que haya un acuerdo firmado y otra épica lo pinte.

## Criterios de aceptación
Entregables en `docs/epicas/EPIC-006-patrocinio/_qa/estudio-mercado/`:
`<fecha>-informe.md` y `<fecha>-ficha.md` (fecha ISO).
- **CA-1 Comparables con fuente.** El informe trae una tabla de **≥ 8 cifras**
  `[Cn]`, cada una con importe, moneda, unidad (CPM, €/mes, €/temporada…),
  año de la cifra, URL y fecha de consulta ISO. Cubren al menos 3 de estas
  clases: CPM o tarifa de display en medios deportivos o regionales;
  patrocinio de sección de resultados en prensa gallega; apps o webs de
  resultados; patrocinio de deporte base o competición regional gallega. Toda
  cifra sin fuente va marcada `hipótesis` y no cuenta para las 8. Verificación:
  recorrer la tabla fila a fila y abrir cada URL.
- **CA-2 Audiencia en peticiones agregadas.** O bien una línea base de
  **peticiones** (no «visitantes») a `/`, `/es` y `/api/board` el sábado y el
  domingo de al menos una jornada, sacada de logs o métricas agregadas de
  Vercel, con el comando y su salida, y diciendo qué cuentan (función o CDN:
  `s-maxage=10` de SPEC-030 esconde aciertos de caché a la función); o bien la
  declaración explícita de que no existe, con un plan de medición (fuente,
  comando, desde qué jornada) que no use Vercel Analytics, cookies, IP ni
  ningún dato de quien mira. En ambos casos, una proyección a la temporada
  con los supuestos escritos.
- **CA-3 Formatos.** Al menos dos: **jornada patrocinada** y **competición
  patrocinada por temporada**. Cada uno trae boceto en palabras: dónde en
  Xornada (sitio destacado, H-2), texto en gl y es, logotipo de la marca
  (admitido, H-4; ADR-005 prohíbe solo escudos de equipos). Cada formato dice
  que cumple D-8 (tokens, ningún estado solo por color) y que no carga nada de
  terceros: logotipo servido desde el propio dominio, sin píxeles ni scripts.
- **CA-4 Precio contra el suelo.** Rangos bajo, medio y alto en € para cada
  formato (€/jornada y €/temporada), y cada extremo cita los `[Cn]` de los que
  sale o va marcado `hipótesis`. Dice si el mercado **sostiene, no sostiene o
  no permite concluir** el suelo de ≈ 20 €/jornada, con el motivo. Añade una
  prima para jornadas finales y playoff (multiplicador o importe) con fuente
  o como hipótesis.
- **CA-5 Fórmula reproducible.** El informe escribe la fórmula del suelo con
  cada término, su fuente y el tipo de cambio $→€ con fecha y fuente, y la
  cuenta de cobertura: cuántas jornadas al mes, en cada escenario, pagan
  API-Football y cuántas pagan la plataforma entera. SPEC-036 puede usar el
  resultado tal cual (ingreso mensual del escenario bajo − plataforma sin
  datos = disponible para datos).
- **CA-6 Ficha de una página.** `<fecha>-ficha.md` ≤ 40 líneas, sin nombrar a
  ninguna marca concreta: qué es marcador.gal, audiencia con su unidad real
  (o «en medición desde la jornada N»), formatos, precio por jornada y prima,
  condiciones (sin cookies ni seguimiento, sin apuestas, alcohol legal
  admitido, H-3) y un hueco de contacto para el titular. Toda cifra de la
  ficha aparece en el informe con su `[Cn]` o como hipótesis.
- **CA-7 Fuentes limpias.** El informe lista los dominios consultados. Cero
  contactos (correos, formularios, llamadas). Una web con 403 o reto de
  Cloudflare queda `no comprobable` y se cita una fuente secundaria, sin
  proxies, navegadores sin cabeza ni otra elusión.
- **CA-8 Una página y sin código.** El informe, sin su apéndice de fuentes y
  dominios, ≤ 100 líneas, y acaba con las H-n nuevas. `git diff --stat
  origin/main` no toca `src/`, `supabase/`, `data/` ni `tools/`.

## Entidades y reglas afectadas
FOUNDATION no-negociables; D-7 (legalidad, titular), D-8 (diseño); ADR-005;
SPEC-030 (caché de portada); SPEC-036 H-2 (techo de coste); EPIC-006 H-1..H-6.

## Fuera de alcance
- Contactar, negociar o firmar con marcas: lo hace el titular.
- Pintar el patrocinio en pantalla y los ajustes previos de Xornada (H-2).
- Instrumentar medición nueva: si CA-2 cae en plan, será otra spec.
- Publicidad programática, apuestas, otras vías de ingreso, fiscalidad.
- Elegir proveedor de datos (SPEC-036).

## Notas para el gate humano
- **H-1 Doble cuenta en el suelo.** Los ≈ 64 $/mes de `contexto.md` ya
  incluyen API-Football (20 + 25 + 19 $), que además se cobra en USD
  (SPEC-036 S13). Un cuarto de 64 $ ≈ 15 €; un cuarto de 19 + 64 ≈ 19 €.
  *Recomendación:* mantener 20 € como suelo (redondeo prudente) y que el
  informe enseñe las dos cuentas. *Resuelta por el titular (Alberto Fojo, 2026-10-18):* 20 €, con margen.
- **H-2 «Un cuarto» y el calendario.** Hay meses con 5 jornadas y parones.
  *Recomendación:* suelo = coste anual / jornadas de la temporada, y el
  informe da las dos cifras. *Resuelta por el titular (Alberto Fojo, 2026-10-18):* coste anual entre jornadas.
- **H-3 Acceso a los logs.** ¿Hay `vercel` CLI enlazada con permiso para leer
  logs o métricas en el spike? La retención del plan puede no cubrir la
  última jornada. *Recomendación:* si no, CA-2 sale por la vía del plan. *Resuelta por el titular (Alberto Fojo, 2026-10-18):* vía del plan de medición.
- **H-4 Idioma de la ficha.** *Recomendación:* galego, con versión en
  castellano en el mismo fichero si cabe en 40 líneas. *Resuelta por el titular (Alberto Fojo, 2026-10-18):* galego + castellano.
