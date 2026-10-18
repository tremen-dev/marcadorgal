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
| CA-1 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Matriz (6 filas, 8 columnas; estado + condición); corr. R2: vía 3 «sola no cumple (falta 2ª RFEF); complemento de Tercera G1» | recorrido de la matriz: 6 filas; estados ∈ {pendiente de respuesta ×4, no comprobable, no sirve}; R2: la condición de la vía 3 cita el mínimo del criterio común | 6 filas, 8 columnas (las 7 de la spec + #). Estados ∈ conjunto permitido. Fila 3: «`pendiente de respuesta`: solo cubre Tercera G1» contradice el criterio común (sirve exige Tercera G1 **y** 2ª RFEF; «no cubre D-3» = no sirve), y §Recomendación 3 propone «alta solo para Tercera G1» (finding R2) | ⚠️ |
| CA-2 | `_qa/vias-de-acceso/2026-10-18-informe.md` celdas `[Sn]` + §Apéndice S0–S19 (URL, 2026-10-18); corr. R1 (S3 = circular 2021/22, femenino y sala) y R3 (S0 = rfef.es/es/contacto; plazos de las vías 4 y 6 como estimación con motivo; S15 desglosado: Tercera 2/9 y 4/8, 2ª RFEF 1/9) | recorrido celda a celda; cada «desconocido» lleva su motivo (requiere contacto, 403, a consultar); recorrido de nuevo de las celdas de las vías 4 y 6 y de S0, S3 y S15 | Muestra de 12 citas comprobadas (ver Veredicto). **S3 no sostiene la afirmación**: la circular 25 (2021/22) cubre 2ª B, 1ª y 2ª RFEF **Fútbol Femenino** y futsal; Primera RFEF masculina queda aplazada (pág. 4). Celdas sin fuente: «semanas (venta)» (vía 6), «días o semanas» (vía 4); S0 sin URL; «2–4 partidos por jornada» [S15] solo vale para Tercera (2ª RFEF: 1 de 9) (findings R1, R3) | ❌ |
| CA-3 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Preguntas (RFEF, Novanet, RFGF en galego, CSD); corr. R4: «tería» | grep '^\*\*Vía [1-4]' → 4 bloques con destinatario institucional; grep 'tería un medio' → 1 | Preguntas para vías 1, 2, 3 (RFGF en galego) y 4 condicionada. Destinatario concreto solo en vía 1; vías 2 y 3 «canal pendiente / por localizar» (F-SPEC-036-1). Galego: «un medio … terían» → «tería» | ⚠️ |
| CA-4 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Vía 4 (R CTBG 2025-0243 de 04/03/2025, Ley 39/2022 art. 50, Lei 1/2016) | lectura: sin conclusión sobre la obligación; pregunta abierta H-3 | CTBG 2025-0243 leída entera por el verificador: nº, fecha 04/03/2025, expte. 447/2025, RFEF, inadmisión y ambas citas literales (págs. 5-6) coinciden. Ley 39/2022 art. 50 coincide por buscador. Sin conclusión sobre la obligación; H-3 abierta | ✅ |
| CA-5 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Apéndice «Dominios consultados» | grep marcadores.rfef.es → solo en las preguntas y la nota «Ninguna petición»; rfef.es 403 → buscador | Lista de dominios presente; ninguna petición a marcadores.rfef.es ni PNFG; 403 declarado sin eludir. El verificador tampoco tocó marcadores.rfef.es | ✅ |
| CA-6 | `_qa/vias-de-acceso/2026-10-18-informe.md` §Recomendación (6 vías ordenadas: acción, dueño, spec); corr. R1: InStat primero por los derechos TV de 1ª Fed. [S6]; R2: vía 3 como complemento | lectura del orden directo > oficial > plazo > coste; lectura de los puntos 3 y 4 de §Recomendación | 6 vías ordenadas con acción, dueño y spec. El puesto 4 «Hudl InStat primero, por el acuerdo con la RFEF» descansa en parte en S3 mal leída (R1) | ⚠️ |
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
