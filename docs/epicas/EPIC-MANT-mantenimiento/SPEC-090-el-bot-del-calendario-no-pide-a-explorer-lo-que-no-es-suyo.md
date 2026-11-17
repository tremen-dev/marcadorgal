---
id: SPEC-090
tipo: spec
epica: EPIC-MANT
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-17, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-17, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-17, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-11-17, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-17, por: sdd-verificador}
---
# SPEC-090 — El bot del calendario no pide a explorer lo que no es suyo

## Problema
Explorer (rama `feat/femenino-real`, sin desplegar) deja de inventar calendarios: `tercera-rfef-g1` responderá 503, `primera-federacion-fem` 404 y `segunda-federacion-fem-g1` un calendario real con fecha nominal y `timeConfirmed:false`. Hoy `rfefCalendar.fetch` (`src/sources/rfef/calendar.ts`) pide `/api/export/calendar` también para tercera, aunque `parse()` tira la respuesta y construye desde `data/calendario/<season>/tercera-rfef-g1.json`. El 503 lanzaría `rfef explorer calendar responded 503`, `tools/calendario-sync.mjs` saldría con 1 y, con `pipefail`, el paso `sync` de `calendario-semanal.yml` fallaría antes de abrir el PR: ni PR ni auto-merge de las reprogramaciones de las otras 4. **Esta spec se fusiona antes de desplegar explorer.**

## Usuarios / roles afectados
Titular (PR y aviso del bot); público indirectamente (reprogramaciones a tiempo, SPEC-015).

## Criterios de aceptación
Tests con Vitest contra fixtures del repo, `ctx.fetch` espía y el proveedor falso de `src/calendar/cli.test.ts` (`--import cli.fake-provider.mjs`, ampliable para responder un estado por competición). Nunca red.
- **CA-1 (tercera sin red)**: Dado `tercera-rfef-g1` y `2026-27`, cuando el importador `rfef` hace `fetch` + `parse`, entonces `ctx.fetch` se llama 0 veces y el resultado es el del fichero declarado: sus 306 partidos y `teams[]`, con `externalId` `2026-27-3rfef-j<round>-<home>-<away>` (idéntico al de hoy; `src/calendar/sync-rfef.test.ts` sigue verde). Ningún camino del importador construye tercera desde una respuesta de explorer.
- **CA-2 (tercera sin fichero no se inventa)**: Dada una temporada sin `data/calendario/<season>/tercera-rfef-g1.json`, cuando se hace `fetch`, entonces lanza un error que nombra competición y temporada, sin llamar a `ctx.fetch` ni devolver un calendario vacío.
- **CA-3 (cobertura = las cinco de D-3)**: `covers` es `true` solo para las cinco de `COMPETITIONS` (`src/calendar/importers.ts`, sin cambios) y `false` para `liga-f`, `primera-federacion-fem` y `segunda-federacion-fem-g1`; `fetch` de cualquiera de esas tres lanza `does not cover` sin llamar a `ctx.fetch`. `calendario:sync -- 2026-27 segunda-federacion-fem-g1` sigue saliendo con 1 por competición desconocida.
- **CA-4 (las masculinas se fusionan con tercera en 503)**: Con el proveedor falso respondiendo 503 a cualquier petición de calendario de `tercera-rfef-g1` y solo una reprogramación en `primera-division`, cuando corre `calendario:sync -- 2026-27 --dry-run`, entonces sale con 0, ninguna petición de calendario pide `competition=tercera-rfef-g1` y `GITHUB_OUTPUT` trae `auto=si`.

## Entidades y reglas afectadas
D-3 (las cinco competiciones), D-9 (un fallo no es un dato). ADR-026 (explorer importa el calendario), ADR-031 y SPEC-071 (correcciones de horas reales: no cambian), SPEC-015 CA-3/CA-4 y H-1 (`autoAplicable`; «un run fallido nunca fusiona» sigue en pie), SPEC-075 (aviso, sin cambios), SPEC-088/089 (femenino sin calendario declarado). ADR-028: toca `src/`, sube versión `patch`.

## Fuera de alcance
- Aislar el fallo por competición (que el fallo de una no bloquee el PR de las demás) y cambiar `calendario-semanal.yml`: aparcado por decisión del titular (2026-11-17), posible spec futura.
- Declarar calendarios femeninos en `data/calendario` o dar fuente a `segunda-federacion-fem-g1` en las páginas (SPEC-089 la deja `none`; volver a darle fuente requiere spec y dato real).
- El export de partidos por día (`getDayMatches`) que usan las correcciones reales: su fallo ya se aísla por competición y no cambia.
- Cambios en explorer.

## Notas para el gate humano
1. **Alcance recortado a CA-1..CA-4** por decisión del titular (2026-11-17). CA-4 pierde la aserción `fallidas=` vacío: esa salida solo existía con el aislamiento retirado; hoy el sync solo emite `urgentes` y `auto`.
2. **`segunda-federacion-fem-g1` fuera del bot:** nunca estuvo en `COMPETITIONS`; CA-3 solo alinea `covers` con eso. Su calendario real de explorer no entra en `data/calendario` hasta otra spec.
3. **Orden de despliegue:** fusionar esta spec antes de desplegar `feat/femenino-real` de explorer.
