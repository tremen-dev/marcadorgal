---
id: SPEC-075
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-075 Aviso cuando falla el bot del calendario

## Resumen
- Fase: hecho (CA-5 pendiente tras fusionar)
- Rama: `ft/SPEC-075-aviso-cuando-falla-el-bot-del-calendario`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/calendar/aviso.ts` (`decidirAviso`, `cuerpoIncidente`, `leerIncidente`) | `src/calendar/aviso.test.ts` «SPEC-075 CA-1 decidirAviso» (tabla de 14 casos) y «marker» | `vitest` aviso.test.ts: 14 casos de tabla + marcador en verde; leído: sin reloj/red/gh, `load` ok no cierra `sync` | ✅ |
| CA-2 | `tools/aviso-bot-calendario.mjs` (`avisar`, `enlaceEjecucion`) | `src/calendar/aviso-bot-calendario.test.ts` «SPEC-075 CA-2 one alert per incident» (gh falso: 1 create, 2 edit, 1 comment, 1 close; fallo posterior abre issue nuevo, 0 reopen) | gh falso: 1 create, 2 edit, 1 comment, 1 close, 0 reopen; fallo posterior abre #2. Import real con Node 22.19 (type stripping) + gh inyectado → `abrir #7` tras `label create`. `gh api …/collaborators/albertofojo/permission` → admin | ✅ |
| CA-3 | `.github/workflows/calendario-semanal.yml` job `aviso`; `src/calendar/aviso.ts` `observacionDeJob`; `tools/aviso-bot-calendario.mjs` `observacionesDeJobs` | `src/arch/aviso-calendario-workflow.test.ts` «SPEC-075 CA-3 …»; `aviso.test.ts` «CA-3 job result → observation»; `aviso-bot-calendario.test.ts` «inputs of the executor» | test estructural en verde; `git diff origin/main` del workflow: solo 31 líneas añadidas al final; PyYAML: jobs `[sync, load, aviso]`; sin filtro de evento | ✅ |
| CA-4 | `.github/workflows/vigia-calendario.yml`; `src/calendar/aviso.ts` `observarSchedule` (umbral 96 h); `tools/aviso-bot-calendario.mjs` `observacionesVigia` | `aviso.test.ts` «SPEC-075 CA-4 observarSchedule» (martes 23:00Z ok, miércoles 13:00Z fallo, sin ejecuciones fallo); `aviso-calendario-workflow.test.ts` «CA-4/CA-5 vigia-calendario.yml» | tests martes 23:00Z ok / miércoles 13:00Z fallo / vacío fallo en verde; `gh run list --event schedule --json createdAt` real devuelve el formato esperado (últimas llegan 09:11–12:49Z: sin falso positivo en semana normal) | ✅ |
| CA-5 | Preparado, no ejecutado (tras fusionar): input `simular` (`'no'`/`fallo`) en `vigia-calendario.yml`; `observacionesVigia` con `simular=fallo` no consulta `gh` | `aviso-bot-calendario.test.ts` «simular=fallo forces the failure without asking gh»; `aviso-calendario-workflow.test.ts` «accepts simular…», «never touches explorer or the database». Prueba real: ver handoff | Preparado y documentado (input `simular`, test sin gh, workflow sin `npm ci`/`DATABASE_URL`/`RFEF_EXPLORER`). **Prueba real pendiente tras fusionar** (pasos en handoff), por decisión del titular | ⚠️ |
| CA-6 | `package.json`/`package-lock.json` 0.5.4 → 0.5.5 (`npm version patch --no-git-tag-version`) | `npm run gates`: typecheck y lint OK; test 158/159 ficheros, 2623 pasan, 1 falla (ajeno conocido: `src/db/test-db.test.ts` «wins over a .env file in the cwd too»); `npm run build` → 0 por separado; `src/arch/deploy.test.ts` 27/27; `node tools/version-gate.mjs --base origin/main` → «ok — 0.5.4 → 0.5.5, package-lock.json coherente» | `tsc` 0, `biome` 0, `vitest` 2623 ok / 1 ajeno conocido (`test-db` «wins over a .env…»), `next build` 0; deploy.test 27/27 (4 ficheros, 82 tests); `version-gate` 0.5.4 → 0.5.5 ok | ✅ |

Respuestas del titular a las preguntas abiertas de la spec (2026-11-10, vía orquestador): (1) el vigía CA-4 va en esta spec; (2) umbral 96 h; (3) el issue se **asigna** a `albertofojo`; (4) avisa con cualquier evento, también `workflow_dispatch`.

Evidencia «los pasos de `sync` y `load` no cambian» (CA-3): `git diff main -- .github/workflows/calendario-semanal.yml` → 31 líneas añadidas al final, 0 borradas. PyYAML parsea los dos workflows: jobs `['sync','load','aviso']` y `['vigia']`; `simular.options` = `["no","fallo"]` (cadenas).

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
**GREEN — 2026-11-10 (sdd-verificador).** CA-1..CA-4 y CA-6 ✅ con tests no vacíos y ejecución real del ejecutor bajo Node con `gh` inyectado. CA-5 ⚠️: **verificación posterior al merge**, aceptada por el titular; la lanza él con los pasos del handoff y el resultado (URL del issue, email recibido, cierre con comentario) se anota aquí. Si CA-5 falla, se reabre como fix.
Observaciones menores, no bloqueantes: (a) Node avisa `MODULE_TYPELESS_PACKAGE_JSON` al importar `src/calendar/aviso.ts` desde el `.mjs` (solo ruido en el log); (b) si alguien borra a mano el marcador del cuerpo, la siguiente ejecución sin fallos cierra el incidente (caso «marcador perdido» de la tabla, deliberado).

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-075/. Informe HTML opcional: _qa/SPEC-075/informe.html -->
n-a: la spec no tiene UI. Evidencia por comando en la matriz.

## Salvedades / follow-ups
<!-- IDs F-SPEC-075-1, F-SPEC-075-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-075-1** (EPIC-MEJORA): `concurrency` de GitHub guarda una sola ejecución pendiente por grupo; si coinciden tres (aviso + vigía + otro aviso), la pendiente más vieja se cancela sin observar. `cancel-in-progress: false` solo protege la que está corriendo. Riesgo bajo: el siguiente aviso o el vigía del día siguiente reobservan.
- **F-SPEC-075-2** (aceptado por la letra de CA-1): con un incidente abierto, una ejecución que no observa nada o que observa otra causa en `ok` **actualiza** (añade su enlace al cuerpo). En la práctica, el vigía añade una línea diaria al cuerpo de un incidente de `sync`. Editar no notifica.
- **F-SPEC-075-3**: el formato real de salida de `gh` (`issue create` imprime la URL; `label list --search`, `run list --event schedule --json createdAt`) solo se ha probado contra el `gh` falso. CA-5 lo prueba contra GitHub.
- **F-SPEC-075-4**: «los pasos de `sync` y `load` no cambian» se comprueba con `git diff` (arriba), no con un test permanente: congelar esos pasos en un test bloquearía cambios legítimos futuros.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- Hecho (sdd-implementador, 2026-11-10): CA-1..CA-4 y CA-6 con tests; CA-5 preparado. Spec en `en-revision`. Sin red ni producción: ningún workflow lanzado ni issue creado.
- Falta: verificación; después, fusionar y ejecutar CA-5 a mano (el titular o el orquestador):
  1. `gh workflow run vigia-calendario.yml --ref main -f simular=fallo` → debe abrirse un issue con la etiqueta `bot-calendario`, asignado a `albertofojo`, causa «sin-ejecuciones». Anotar aquí su URL (`gh issue list --label bot-calendario`).
  2. El titular confirma que le llegó el email (GitHub → Settings → Notifications, *Participating*).
  3. `gh workflow run vigia-calendario.yml --ref main` (simular=no) → mientras la última ejecución `schedule` de `calendario-semanal.yml` tenga menos de 96 h, el issue se cierra con el comentario «Resuelto: …». Anotar el enlace del comentario.
  4. Nada de esto toca explorer ni la base (el workflow no tiene `npm ci`, `DATABASE_URL` ni `RFEF_EXPLORER_*`).
- Versión: 0.5.5. `main` está en 0.5.4 y otro PR abierto también sube a 0.5.5: si choca al fusionar, subir a 0.5.6.
