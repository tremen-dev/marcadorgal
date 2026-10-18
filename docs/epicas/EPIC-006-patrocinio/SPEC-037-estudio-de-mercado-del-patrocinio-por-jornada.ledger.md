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
| CA-1 | `_qa/estudio-mercado/2026-10-18-informe.md` §1: 15 cifras C1–C15, 3 clases | Recorrer la tabla fila a fila y abrir cada URL (todas consultadas 2026-10-18) | | ❌ |
| CA-2 | `_qa/estudio-mercado/2026-10-18-informe.md` §2: no hay línea base; plan con `vercel metrics vercel.request.count` y proyección 300/1.000/3.000 cargas | Leer §2: fuente, comando, jornada 24-25/10 (H-11), supuestos `hipótesis`; sin Analytics, cookies ni IP | | ❌ |
| CA-3 | `_qa/estudio-mercado/2026-10-18-informe.md` §3: A Xornada patrocinada y B Competición patrocinada, textos gl/es, logotipo propio, D-8 | Leer §3 contra D-2, D-8, ADR-005 y `docs/diseno/_tokens.css` (tokens citados existen) | | ❌ |
| CA-4 | `_qa/estudio-mercado/2026-10-18-informe.md` §4: rangos A 20/35/60 €, B 500/1.000/2.000 €; prima ×1,3; veredicto «no permite concluir» | Leer §4: cada extremo cita [Cn] o `hipótesis` | | ❌ |
| CA-5 | `_qa/estudio-mercado/2026-10-18-informe.md` §5: fórmula, K1–K4 (BCE 1,1253 a 2026-10-16), J = 42, cobertura y 30,01 €/mes para SPEC-036 | Rehacer: `python3 -c "print(64*12/(1.1253*42), 64/1.1253/4, 20*42/12-45/1.1253)"` → 16,25 · 14,22 · 30,01 | | ❌ |
| CA-6 | `_qa/estudio-mercado/2026-10-18-ficha.md`: 31 líneas, gl + es, sin marcas | `wc -l` ≤ 40; `grep -iE "gadis|froiz|abanca|estrella"` sin resultado; cifras de la ficha en informe §2, §4, §5 | | ❌ |
| CA-7 | `_qa/estudio-mercado/2026-10-18-informe.md` apéndice: dominios consultados; 403 de api-football.com `no comprobable` con secundaria | Leer apéndice; cero contactos | | ❌ |
| CA-8 | `_qa/estudio-mercado/2026-10-18-informe.md`: cuerpo 98 líneas (con la línea en blanco previa al apéndice), acaba con H-11..H-14 | `awk '/^## Apéndice/{exit} {n++} END{print n}'` → 98; `git diff --stat origin/main` sin `src/ supabase/ data/ tools/` | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

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
- Falta: verificación (sdd-verificador) y decisiones H-11..H-14 del titular.
