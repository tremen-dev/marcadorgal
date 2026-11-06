---
id: ADR-026
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-06, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-06, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-026: Sustitución de API-Football por explorer para calendario y retirada de API-Football de las fuentes activas

- Deciders: sdd-arquitecto propone (2026-11-06) tras la confirmación de despliegue de marcadorgal-explorer v2.0 en producción. **Alberto Fojo (titular)** aprueba la eliminación de la dependencia de API-Football y la adopción de explorer como importador oficial del calendario.
- Specs relacionadas: SPEC-049 (lo ejecuta); SPEC-004 (calendario base); SPEC-038 (alta de explorer); SPEC-039 (jornada de observación). **Supersede:** ADR-017 §5 y ADR-023 §1 (la prioridad de rfef/explorer sube de 5 temporal a 50 como fuente federativa oficial y única fuente activa); retira API-Football de `SOURCES`.

## Contexto
El plan de pago de API-Football (19 $/mes) ha vencido y no se ha renovado. `marcadorgal-explorer` ha desplegado en producción (`https://marcadorgal-explorer.vercel.app`) su versión 2.0 multi-proveedor, ofreciendo:
1. `GET /api/export/calendar?competition=:id&season=:season`: exportación completa del calendario declarado con nombres oficiales federativos de la RFEF y horarios confirmados de LaLiga mediante MARCA.
2. `GET /api/export/matches?date=YYYY-MM-DD`: marcadores en directo con goles ligeros embebidos (`goals`) e identificadores canónicos resueltos.
3. Módulos de clasificaciones (`/standings`) y estadísticas (`/stats/scorers`, `/stats/goalkeepers`).

Mantener API-Football en `src/sources/registry.ts` provoca errores 401/403 o fallos de variable de entorno en cada tick. El objetivo de ahorro de costes fijado en el roadmap (H-9 de SPEC-036) se alcanza al asumir explorer la totalidad de la ingesta y del calendario.

## Decisión
1. **Explorer como importador oficial del calendario (`CalendarImporter`).** Se implementa `rfefCalendar` en `src/sources/rfef/calendar.ts`, registrado como primer importador en `src/calendar/importers.ts`. Consume `GET /api/export/calendar` de explorer autenticado con `RFEF_EXPLORER_TOKEN` (o `EXPLORER_API_KEY`).
2. **Desacoplamiento de `tools/calendario-sync.mjs`.** La herramienta de sincronización acepta credenciales de explorer (`RFEF_EXPLORER_TOKEN`), manteniendo compatibilidad retroactiva.
3. **Retirada de API-Football de las fuentes activas.** Se retira `api-football` de `SOURCES` en `src/sources/registry.ts`. La fuente `rfef` pasa a prioridad 50 (`FEDERATION_PRIORITY`, ADR-017 §5 restaurado), siendo la fuente autoritativa oficial de las cinco divisiones.
4. **Cliente de consumo de nuevas entidades.** Se añade `src/lib/explorer-client.ts` con funciones tipadas para consumir el calendario oficial, partidos con goles en directo, clasificaciones, Pichichi y Trofeo Zamora.

## Consecuencias
### Positivas
- Se elimina el coste de 19 $/mes de API-Football definitivamente (0 $ de coste de datos).
- El calendario incorpora los nombres federativos oficiales (D-2) de la RFEF y las fechas televisivas confirmadas vía MARCA.
- El tick de ingesta deja de sufrir errores de autenticación o cuota con API-Football.
- Se disponen de los clientes listos para las próximas vistas de clasificación y estadísticas.
### Negativas / follow-ups
- La fuente directa de API-Football queda como archivo histórico en `src/sources/api-football/`, disponible si en el futuro se requiriese como reserva de emergencia.
