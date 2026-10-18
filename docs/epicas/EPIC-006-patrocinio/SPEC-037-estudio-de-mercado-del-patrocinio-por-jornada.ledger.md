---
id: SPEC-037
tipo: ledger
epica: EPIC-006
---
# Ledger — SPEC-037 Estudio de mercado del patrocinio por jornada

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `docs/EPIC-006-patrocinio` (spike sin código vigilado)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `_qa/estudio-mercado/2026-10-18-informe.md` §1: 15 cifras C1–C15, 3 clases | Recorrer la tabla fila a fila y abrir cada URL (todas consultadas 2026-10-18) | 15/15 cifras comprobadas en origen: C1–C4 PDF DV leído (CPM Home 25/Site 20, Brand Day home 2.200, recargo 30 % «Prioridad en Posicionamiento», 2026, sin IVA); C5–C6 PDF Burgos Conecta 2025 (CPM 20 €, Brand Day 2500); C7–C8 PDF Ara 2025 (megabanner 18/24); C9–C10 BOP Córdoba 108 (80 €/mes, 150 €/mes); C11–C12 netcom (110/150 €/mes, `Last-Modified: 24 Mar 2013`); C13 xunta.gal 25/05/2022 5.000 €; C14 2.208.250 €/117 equipos, 05/12/2025; C15 «500 – 2.000 euros», 05/02/2026. 3 clases. | ✅ |
| CA-2 | `_qa/estudio-mercado/2026-10-18-informe.md` §2: no hay línea base; plan con `vercel metrics vercel.request.count`, lectura de `/api/board` según `src/live/transport.ts` y `src/xornada/live.ts:16` (R4), y proyección 300/1.000/3.000 cargas | Leer §2: fuente, comando, jornada 24-25/10 (H-11), supuestos `hipótesis`; sin Analytics, cookies ni IP | Re-verificado en 40e63af (R4 corregido): §2 lee `/api/board` como *polling* 30 s ±20 % (`src/live/transport.ts:15-16` `POLL_MS = 30_000`, `JITTER = 0.2`), una al hidratar si `servedAt` > 45 s y tope de 30 s por `matchId` desconocido (`src/xornada/live.ts:16`). Plan, comando, H-11 y supuestos `hipótesis` sin cambios; S4/S5 contrastados en vercel.com. | ✅ |
| CA-3 | `_qa/estudio-mercado/2026-10-18-informe.md` §3: A Xornada patrocinada y B Competición patrocinada, textos gl/es, logotipo propio, D-8 | Leer §3 contra D-2, D-8, ADR-005 y `docs/diseno/_tokens.css` (tokens citados existen) | A y B con sitio, texto gl/es, logotipo propio, sin terceros, `rel="sponsored"`, D-8. Tokens `--bg-elev --fg-dim --line --directo --alerta --amber --marca` existen en `docs/diseno/_tokens.css` (1 c/u). | ✅ |
| CA-4 | `_qa/estudio-mercado/2026-10-18-informe.md` §4: rangos A 20/35/60 €, B 500/1.000/2.000 € (÷ 34–42 rondas: 11,90–14,71 / 23,81–29,41 / 47,62–58,82 €); prima ×1,3; veredicto «no permite concluir»; B contra coste anual (R1) | Leer §4: cada extremo cita [Cn] o `hipótesis` | Re-verificado en 40e63af (R1 corregido): rondas por fichero 38/38/42/34/34 (`new Set(matches.map(m=>m.round)).size`); B ÷ 42 y ÷ 34 → 11,90–14,71 / 23,81–29,41 / 47,62–58,82 €: coincide. Coste anual 64×12/1,1253 = 682,48 € (42×16,25 = 682,50) y 42×20 = 840 €; «B bajo no cubre, B medio sí» es correcto. Rangos A y prima ×1,3 [C4][C7][C8] sin cambios. | ✅ |
| CA-5 | `_qa/estudio-mercado/2026-10-18-informe.md` §5: fórmula, K1–K4 (BCE 1,1253 a 2026-10-16), J = 42 semanas del sitio y rondas por competición 38/42/38/34/34 (R1), cobertura y 30,01 €/mes para SPEC-036 | Rehacer: `python3 -c "print(64*12/(1.1253*42), 64/1.1253/4, 20*42/12-45/1.1253)"` → 16,25 · 14,22 · 30,01 | Reproducido: J = `42 2026-08-10 2027-05-31`, por mes {08:4,09:4,10:4,11:5,12:3,01:4,02:4,03:5,04:4,05:5}, hueco 2026-12-21. BCE `time=2026-10-16` `USD 1.1253`. 64×12/(1,1253×42)=16,25; 64/1,1253/4=14,22; 83/1,1253/4=18,44; 83×12/(1,1253×42)=21,07; 19/1,1253=16,88; 64/1,1253=56,87; cobertura 0,84/2,84/0,48/1,62/0,28/0,95; 70,00−39,99=30,01 (33,77 $); H-13 40,01. 64 $ incluye 20+25+19 (`contexto.md:139`). Todo coincide. | ✅ |
| CA-6 | `_qa/estudio-mercado/2026-10-18-ficha.md`: 31 líneas, gl + es, sin marcas; audiencia «desde a xornada N» (R2); «as tres no grupo 1» (R3); 34 a 42 xornadas (R1) | `wc -l` ≤ 40; `grep -iE "gadis|froiz|abanca|estrella"` sin resultado; cifras de la ficha en informe §2, §4, §5 | Re-verificado en 40e63af: `wc -l` = 31; grep de marcas = 0. R1: «de 34 a 42 xornadas, segundo a competición» / «de 34 a 42 jornadas, según la competición» (en informe §3, §5). R2: «desde a xornada N (a primeira tras activar a medición)» condicionado. R3: «Primeira, Segunda e Terceira Federación, as tres no grupo 1» / «las tres en el grupo 1». Galego de los cambios correcto (segundo, tras, as tres no). Cifras 35, 46, +30 %, 1.000, 34–42 en informe §4–§5 / H-12. | ✅ |
| CA-7 | `_qa/estudio-mercado/2026-10-18-informe.md` apéndice: dominios consultados; 403 de api-football.com `no comprobable` con secundaria | Leer apéndice; cero contactos | Apéndice con dominios; K3 api-football.com 403 `no comprobable` + secundaria thestatsapi.com abierta (Pro 19 $/mes, 7.500/día, 18/02/2026 act. 07/05/2026: coincide). Sin contactos. | ✅ |
| CA-8 | `_qa/estudio-mercado/2026-10-18-informe.md`: cuerpo 99 líneas (con la línea en blanco previa al apéndice), acaba con H-11..H-14 | `awk '/^## Apéndice/{exit} {n++} END{print n}'` → 99; `git diff --stat origin/main` sin `src/ supabase/ data/ tools/` | Re-verificado en 40e63af: `awk` → 99 (≤ 100), acaba con §6 H-11..H-14; ficha 31; `git diff --name-only origin/main...HEAD` filtrado por `src/`, `supabase/`, `data/`, `tools/` → vacío (grep exit 1). | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-10-18, sdd-verificador, sobre 40e63af.** R1–R4 corregidos y re-verificados (CA-2, CA-4, CA-6, CA-8 ✅; CA-1, CA-3, CA-5, CA-7 se mantienen ✅). Aritmética nueva rehecha: B ÷ 34–42 rondas, 682,48 € y 840 € anuales. Pendiente fuera de la spec: H-11..H-14 del titular.

Histórico (primera pasada):
**RED — 2026-10-18, sdd-verificador.**
Comprobado: las 15 cifras [C1–C15] en origen (PDF descargados y leídos; WebFetch para HTML), K1–K4, S4–S6; aritmética de §4 y §5 rehecha (J = 42, BCE 1,1253, 16,25 / 14,22 / 30,01). CA-1, CA-3, CA-5, CA-7, CA-8 ✅.
Findings:
- **R1 (bloqueante).** «42 xornadas» se atribuye a una competición. 42 son semanas con partido de cualquiera de las cinco (S6); por competición: Primeira División 38, Primeira Federación 38, Segunda División 42, Segunda Federación 34, Terceira Federación 34. Corregir la ficha (gl y es: «durante toda a tempada (42 xornadas)»), la fila «B, €/jornada (÷ 42)» de §4 (dividir por las rondas de cada competición o dar el rango 23,81–29,41 € para 1.000 €) y la frase del veredicto «B vendida sola (11,90 €/jornada) queda bajo el suelo» (con 34 rondas, 500 € = 14,71 €).
- **R2.** Ficha: «En medición desde a xornada do 24-25/10/2026» se presenta como hecho; el informe §2 lo condiciona a H-11, sin resolver. Condicionarlo en la ficha («en medición desde a xornada N») o resolver H-11 antes.
- R3 (menor). Ficha gl/es: «… Segunda Federación e Terceira Federación, grupo 1» → indicar que el grupo 1 es de las tres Federacións (p. ej. «Primeira, Segunda e Terceira Federación (grupo 1)»).
- R4 (menor). §2: «polling de respaldo cada 30 s» → lo que hay es un tope de una petición a `/api/board` cada 30 s por matchId desconocido (`src/xornada/live.ts:16`).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-037/. Informe HTML opcional: _qa/SPEC-037/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-037-1, F-SPEC-037-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-037-1: medición de audiencia (CA-2 cayó en plan). Destino: spec de EPIC-006 si H-11 = sí; confirmar dimensiones con `vercel metrics schema vercel.request`.
- F-SPEC-037-2: sin cifra pública de patrocinio de sección de resultados en prensa gallega ni de apps de resultados; C11–C12 son de 2013 y de Asturias. Destino: el titular, si consigue tarifas al hablar con medios (fuera de alcance).
- F-SPEC-037-3: el precio de la ficha (35 €, 46 €, 1.000 €) depende de H-12; si cambia, se rehace la ficha.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (2026-10-18, sdd-implementador): informe y ficha en `_qa/estudio-mercado/`. Spec en `en-revision`.
- Evidencia J = 42: `node -e 'const fs=require("fs"),d="data/calendario/2026-27/",w=new Set();for(const f of fs.readdirSync(d))for(const m of JSON.parse(fs.readFileSync(d+f)).matches){const t=new Date(m.kickoff),k=(t.getUTCDay()+6)%7;w.add(new Date(t-k*864e5).toISOString().slice(0,10))}const s=[...w].sort();console.log(s.length,s[0],s.at(-1))'` → `42 2026-08-10 2027-05-31`.
- Evidencia K4: `curl -s https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml | grep -E "time=|USD"` → `time='2026-10-16'`, `rate='1.1253'`.
- PDF sin texto vía WebFetch (C1–C8): leídos con la herramienta Read (C1–C4) o extrayendo cadenas de los *streams* zlib (C5–C8) en el scratchpad.
- RED del verificador (R1–R4) corregido el 2026-10-18: B dividido por las rondas de cada competición (`node -e` con `new Set(matches.map(m=>m.round)).size` por fichero → 38, 38, 42, 34, 34), veredicto de B contra coste anual, ficha condicionada a H-11 y con «grupo 1» de las tres Federacións, §2 con el comportamiento real de `/api/board`. Spec de nuevo en `en-revision`.
- Falta: reverificación (sdd-verificador) y decisiones H-11..H-14 del titular.
- 2026-10-18, sdd-verificador: RED (R1–R4, ver Veredicto). Spec a `en-progreso`. Al corregir, re-verificar CA-4 y CA-6.

- 2026-10-18, sdd-verificador: GREEN tras re-verificar 40e63af; spec a `hecho`. Pendiente: H-11..H-14 del titular.
