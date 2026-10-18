---
id: SPEC-036
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-036 Vías legítimas de acceso a los datos de la RFEF

## Resumen
- Fase: <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `docs/SPEC-036-vias-de-acceso-rfef` (spike sin código vigilado)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Matriz (6 filas, 8 columnas; estado + condición) | recorrido de la matriz: 6 filas; estados ∈ {pendiente de respuesta ×4, no comprobable, no sirve} | | ❌ |
| CA-2 | `_qa/vias-de-acceso/2026-10-18-informe.md` celdas `[Sn]` + §Apéndice S0–S19 (URL, 2026-10-18) | recorrido celda a celda; cada «desconocido» lleva su motivo (requiere contacto, 403, a consultar) | | ❌ |
| CA-3 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Preguntas (RFEF, Novanet, RFGF en galego, CSD) | grep '^\*\*Vía [1-4]' → 4 bloques con destinatario institucional | | ❌ |
| CA-4 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Vía 4 (R CTBG 2025-0243 de 04/03/2025, Ley 39/2022 art. 50, Lei 1/2016) | lectura: sin conclusión sobre la obligación; pregunta abierta H-3 | | ❌ |
| CA-5 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Apéndice «Dominios consultados» | grep marcadores.rfef.es → solo en las preguntas y la nota «Ninguna petición»; rfef.es 403 → buscador | | ❌ |
| CA-6 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Recomendación (6 vías ordenadas: acción, dueño, spec) | lectura del orden directo > oficial > plazo > coste | | ❌ |
| CA-7 | `_qa/vias-de-acceso/2026-10-18-informe.md` (líneas antes de §Apéndice) | `awk '/^## Apéndice/{exit}{n++}END{print n}'` → 73 (≤ 80); cierra con H-7..H-10 | | ❌ |
| CA-8 | sin cambios en src/, supabase/, data/ ni tools/ | `git diff --stat origin/main...HEAD -- src supabase data tools` → vacío | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-036/. Informe HTML opcional: _qa/SPEC-036/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-036-1, F-SPEC-036-2… con destino (spec futura o EPIC-MEJORA). -->
- F-SPEC-036-1: el correo institucional de la RFGF y el canal comercial de Novanet no se han localizado (futgal.es devuelve el cuerpo vacío a WebFetch; softwaredoit.es es un intermediario). Destino: el titular, a mano.
- F-SPEC-036-2: el texto de R/0454/2018 (CTBG) no se ha leído porque el PDF da 404 tras la redirección; solo se cita por buscador. La precedente leída es R CTBG 2025-0243. Destino: el verificador o el titular.
- F-SPEC-036-3: no se ha encontrado ninguna resolución de la Comisión da Transparencia de Galicia sobre la RFGF. Destino: el titular, si sigue la vía 4.
- F-SPEC-036-4: la cobertura de Sportradar, Genius y Opta para 2ª y 3ª Federación no aparece en lo público. Depende de H-9.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
2026-10-18, sdd-implementador: el informe está entregado y la spec, en `en-revision`. Falta la verificación (CA-1..CA-8) y, después, las respuestas a los correos del titular. Si una vía pasa a `sirve`, se abre la spec que indica la §Recomendación. H-7..H-10 van al gate humano.
