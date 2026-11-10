---
id: SPEC-075
tipo: spec
epica: EPIC-FIX
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-10, por: sdd-implementador}
---
# SPEC-075 — Aviso cuando falla el bot del calendario

## Problema
El job `sync` de `.github/workflows/calendario-semanal.yml` falló en **13 ejecuciones programadas seguidas**, del 2026-10-21 al 2026-11-06 (`gh run list --workflow calendario-semanal.yml --event schedule`), y nadie se enteró hasta SPEC-074 (F-SPEC-074-2): durante esas tres semanas no llegaron reprogramaciones ni kickoffs reales (ADR-031). GitHub solo avisa por email al último que tocó el cron, una vez por ejecución, y ese aviso no se vio. Hace falta un aviso que el titular no pueda pasar por alto y que no le escriba 13 veces. El canal se decide en ADR-032.

## Usuarios / roles afectados
Titular (Alberto Fojo, `albertofojo` en GitHub): recibe el aviso. Público, indirectamente: el calendario deja de envejecer sin que nadie lo sepa.

## Criterios de aceptación
Vocabulario: un **incidente** es el issue abierto con la etiqueta `bot-calendario` (como mucho uno). Sus **causas** son `sync`, `load` y `sin-ejecuciones`, guardadas en el cuerpo en un marcador legible por máquina. Una **observación** asigna a una causa `fallo` u `ok`.
- **CA-1 (decisión pura)**: Una función pura (sin reloj, red ni `gh`; p. ej. `src/calendar/aviso.ts`) recibe el incidente abierto (o ninguno) y las observaciones, y devuelve `abrir`, `actualizar`, `cerrar` o `nada`. La causa con `fallo` entra en el conjunto y la causa con `ok` sale. Sin incidente y con algún fallo → `abrir`. Con incidente, si el conjunto queda vacío → `cerrar`, y si no → `actualizar`. Sin incidente y sin fallos → `nada`. Un `load` en `ok` no cierra un incidente de `sync`. Test de tabla con todos los casos.
- **CA-2 (un aviso por incidente)**: Un ejecutor (`tools/aviso-bot-calendario.mjs`) traduce la decisión a llamadas `gh` inyectables. `abrir` crea el issue con la etiqueta, asignado a `albertofojo` y con un enlace a la ejecución (`GITHUB_SERVER_URL/GITHUB_REPOSITORY/actions/runs/GITHUB_RUN_ID`). Crea la etiqueta si falta. `actualizar` solo **edita el cuerpo**: añade la ejecución a la lista y no comenta. `cerrar` comenta «resuelto» con el enlace y cierra. Test con un `gh` falso: tres fallos seguidos de `sync` y un éxito → exactamente 1 `issue create`, 2 `issue edit`, 1 `issue comment` y 1 `issue close`. Un fallo posterior abre un issue **nuevo** y no reabre el cerrado.
- **CA-3 (cableado en el workflow)**: `calendario-semanal.yml` tiene un job `aviso` con `needs: [sync, load]`, `if: always()`, `permissions: {issues: write, contents: read}`, ningún secreto salvo `GITHUB_TOKEN` y `concurrency: aviso-bot-calendario` sin cancelación. El resultado de cada job se traduce así: `failure` o `cancelled` → `fallo`, `success` → `ok`, `skipped` → sin observación. Vale para todo evento (schedule, dispatch, push). Los pasos de `sync` y `load` no cambian. Test estructural leyendo el YAML como texto, al estilo de `src/arch/migraciones-workflow.test.ts`.
- **CA-4 (vigía del schedule)**: Un workflow nuevo, `vigia-calendario.yml`, corre a diario a las 13:00Z, con `workflow_dispatch` y los mismos permisos (más `actions: read`) y la misma `concurrency` que CA-3. Lee la creación de las últimas ejecuciones `schedule` de `calendario-semanal.yml` y una función pura `(ahora, ejecuciones, umbral=96 h)` observa `sin-ejecuciones`: `fallo` si la más reciente es más vieja que el umbral, y `ok` si no. `ahora` llega por parámetro. Tests: con la última el sábado a las 12:00Z, el martes a las 23:00Z da `ok` y el miércoles a las 13:00Z da `fallo`. Sin ninguna ejecución → `fallo`.
- **CA-5 (prueba del canal real, tras fusionar)**: `vigia-calendario.yml` acepta `simular: fallo` por dispatch, que fuerza `sin-ejecuciones = fallo`. En el ledger: URL del issue abierto; confirmación del titular de que le llegó el email; un dispatch normal después; issue cerrado con su comentario. No toca ni explorer ni la base.
- **CA-6 (regresión)**: `npm run gates` → 0. `src/arch/deploy.test.ts` y el resto de la suite siguen en verde. Sube la versión `patch` (ADR-028).

## Entidades y reglas afectadas
ADR-032 (canal y forma del aviso), SPEC-015 (bot del calendario, `chore/calendario`), SPEC-074 / F-SPEC-074-2, ADR-028, ADR-031. Frontera de `CLAUDE.md`: la decisión es pura y el `gh` se inyecta.

## Fuera de alcance
Avisar de fallos de otros workflows (`ci`, `migraciones`, `sonda-pantalla`) o del `migraciones` que lanza el bot. Detectar que GitHub deshabilita **todos** los schedules del repo (60 días sin actividad): el vigía muere con ellos. Avisar de un PR de calendario que espera revisión. Canales con secretos nuevos (Buffer/X, Slack, email propio).

## Notas para el gate humano
- **El email depende de tu configuración**: llega porque el issue te asigna (notificación *Participating*). Revisa que tengas el email activo en GitHub → Settings → Notifications. CA-5 lo prueba de verdad.
- Un `workflow_dispatch` tuyo que falla también abre un incidente. Es deliberado: el conjunto de causas se vacía en cuanto vuelve a ir bien.
- **Preguntas abiertas**: (1) ¿Quieres el vigía (CA-4), o basta con avisar de los fallos? El vigía es lo único que detecta un schedule que deja de dispararse. (2) ¿Te sirve un umbral de 96 h? Los schedules de este repo llegan entre 4 y 7 h tarde, y el hueco de sábado a martes es de 72 h. (3) ¿Quieres que el aviso te asigne a ti o te mencione (`@albertofojo`) en el cuerpo?
