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
| CA-1 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Matriz (6 filas, 8 columnas; estado + condición); corr. R2: vía 3 «sola no cumple (falta 2ª RFEF); complemento de Tercera G1» | recorrido de la matriz: 6 filas; estados ∈ {pendiente de respuesta ×4, no comprobable, no sirve}; R2: la condición de la vía 3 cita el mínimo del criterio común | Re-verif. 9de81fa: 6 filas, 8 columnas, estados permitidos. Vía 3 ya cita el mínimo del criterio común («sola no cumple, falta 2ª RFEF; complemento») y §Recomendación 3 concuerda. R2 cerrado | ✅ |
| CA-2 | `_qa/vias-de-acceso/2026-10-18-informe.md` celdas `[Sn]` + §Apéndice S0–S19 (URL, 2026-10-18); corr. R1 (S3 = circular 2021/22, femenino y sala) y R3 (S0 = rfef.es/es/contacto; plazos de las vías 4 y 6 como estimación con motivo; S15 desglosado: Tercera 2/9 y 4/8, 2ª RFEF 1/9) | recorrido celda a celda; cada «desconocido» lleva su motivo (requiere contacto, 403, a consultar); recorrido de nuevo de las celdas de las vías 4 y 6 y de S0, S3 y S15 | Re-verif. 9de81fa: S3 reproduce la circular (2021/22; 2ª B, 1ª y 2ª RFEF femeninas y sala; 1ª RFEF masculina «próximamente»), cotejado con el PDF. S0 con URL (403 declarado). Plazos de vías 4 y 6 marcados «estimación» con motivo y fuente. S15: Tercera 2/9 (J4) y 4/8 (J5), 2ª RFEF 1/9 = `_epica.md` l. 13-14 = `medicion.md` l. 64-65. S6 (InStat TV, derechos 1ª Fed. 2022-23 a 2024-25) confirmado por buscador (sportbusiness 403; alicanteplaza, xatakamovil). R1 y R3 cerrados | ✅ |
| CA-3 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Preguntas (RFEF, Novanet, RFGF en galego, CSD); corr. R4: «tería» | grep '^\*\*Vía [1-4]' → 4 bloques con destinatario institucional; grep 'tería un medio' → 1 | Re-verif. 9de81fa: preguntas para vías 1–3 y 4 condicionada; RFGF en galego («tería» corregido, R4 cerrado). Salvedad aceptada: destinatario concreto solo en vía 1; vías 2 y 3 con canal por localizar a mano por el titular (F-SPEC-036-1) | ⚠️ |
| CA-4 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Vía 4 (R CTBG 2025-0243 de 04/03/2025, Ley 39/2022 art. 50, Lei 1/2016) | lectura: sin conclusión sobre la obligación; pregunta abierta H-3 | CTBG 2025-0243 leída entera por el verificador: nº, fecha 04/03/2025, expte. 447/2025, RFEF, inadmisión y ambas citas literales (págs. 5-6) coinciden. Ley 39/2022 art. 50 coincide por buscador. Sin conclusión sobre la obligación; H-3 abierta | ✅ |
| CA-5 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Apéndice «Dominios consultados» | grep marcadores.rfef.es → solo en las preguntas y la nota «Ninguna petición»; rfef.es 403 → buscador | Lista de dominios presente; ninguna petición a marcadores.rfef.es ni PNFG; 403 declarado sin eludir. El verificador tampoco tocó marcadores.rfef.es | ✅ |
| CA-6 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Recomendación (6 vías ordenadas: acción, dueño, spec); corr. R1: InStat primero por los derechos TV de 1ª Fed. [S6]; R2: vía 3 como complemento | lectura del orden directo > oficial > plazo > coste; lectura de los puntos 3 y 4 de §Recomendación | Re-verif. 9de81fa: orden y acción/dueño/spec por vía. InStat primero por los derechos de TV de 1ª Fed. [S6], que existen y dicen eso; ya no depende de S3 | ✅ |
| CA-7 | `_qa/vias-de-acceso/2026-10-18-informe.md` (líneas antes de §Apéndice) | `awk '/^## Apéndice/{exit}{n++}END{print n}'` → 73 (≤ 80); cierra con H-7..H-10 | `awk` → 73 líneas antes del apéndice (≤ 80); cierra con H-7..H-10 | ✅ |
| CA-8 | sin cambios en src/, supabase/, data/ ni tools/ | `git diff --stat origin/main...HEAD -- src supabase data tools` → vacío | `git diff --stat origin/main...HEAD -- src supabase data tools` → vacío; diff total = 3 ficheros bajo docs/ | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**RED — 2026-10-18, sdd-verificador.**
Citas comprobadas (WebFetch/WebSearch, 2026-10-18): S4 CTBG 2025-0243 (PDF leído, coincide); S3 circular 25 (PDF leído en www.rfef.es, **no coincide**); S1 nota ATR (Novanet; «clubes, medios, aficionados y federaciones territoriales»: coincide por buscador); S2 (ATR 1ª Fed. 29-30/08 coincide; 2ª Fed. 5-6/09 y 1ª Fed. fem. 13/09 no confirmados por buscador); S7 App Store (Novanet Dev, 3.1.5: coincide); S13 API-Football Pro 19 USD/mes, 7.500/día (coincide por buscador); S5 softwaredoit (14 federaciones, 9.000 clubes, contacto: coincide); S6 InStat derechos 1ª Fed. 2022-25 (coincide); S10 Ley 39/2022 art. 50 (coincide); S14 Hudl sin precio, «Hudl Live Soccer Data» (coincide); S16 Sportradar FDS 2ª B 2019-20 (coincide); S18 SIS/Genius sin RFEF (coincide); S15 repo medicion.md y SPEC-004 CA-4 (ids coinciden; «2–4» impreciso).
Findings:
- **R1 (bloqueante).** S3 se cita como «bases de datos para clubes de 1ª y 2ª RFEF» y «cobertura 1ª y 2ª, según la circular». La circular 25 (temporada 2021/22) cubre 2ª División B, 1ª y 2ª RFEF **de Fútbol Femenino** y futsal; de Primera RFEF masculina dice que «próximamente se adoptarán los acuerdos». Corregir la tabla de vía 6, el apéndice S3 (la elipsis oculta «de Fútbol Femenino») y revisar la justificación de §Recomendación 4.
- **R2.** Vía 3: el estado y su condición contradicen el criterio común (sirve exige mínimo Tercera G1 y 2ª RFEF). Decir qué condición aplica (p. ej. sirve solo combinada con otra vía) o ajustar el estado/la recomendación.
- **R3.** CA-2: dar fuente o motivo a «semanas (venta)» y «días o semanas»; URL para S0 (o motivo); precisar «2–4 partidos por jornada» (Tercera 2/9 y 4/8; 2ª RFEF 1/9).
- R4 (menor). Galego: «un medio dixital galego … terían» → «tería».

**GREEN — 2026-10-18, sdd-verificador (re-verificación de 9de81fa).** R1–R4 cerrados: CA-1, CA-2, CA-4..CA-8 ✅; CA-3 ⚠️ aceptada (canales de Novanet y RFGF por localizar, F-SPEC-036-1, titular). Informe: 73 líneas antes del apéndice; diff sin src/, supabase/, data/ ni tools/. Ninguna vía en `sirve`. Sin peticiones a marcadores.rfef.es ni PNFG.

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
2026-10-18, sdd-verificador: RED (R1–R4 en §Veredicto). Spec devuelta a `en-progreso`; tras corregir, re-verificar CA-1, CA-2, CA-3 y CA-6.
2026-10-18, sdd-implementador: R1–R4 corregidos en el informe; siguen 73 líneas antes del apéndice. Spec de nuevo en `en-revision`.
2026-10-18, sdd-verificador: GREEN tras re-verificar 9de81fa; spec a `hecho`. Pendiente fuera de la spec: respuestas a los correos del titular y H-7..H-10.
