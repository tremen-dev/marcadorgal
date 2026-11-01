# Fixtures del export de explorer (SPEC-038 CA-1)

Respuestas reales de `GET /api/export/matches?date=<YYYY-MM-DD>` del servicio
**explorer** (`marcadorgal-explorer`, fuera de este repo), con el contrato de
ADR-023 §4, guardadas **sin recortar**: el cuerpo tal cual lo sirvió el
endpoint. Los tests corren contra estos ficheros, nunca contra la red.

## Procedencia

Las tres capturas se tomaron el 2026-11-01 (22:07:51Z) contra el endpoint
**corriendo en local** (`npm run dev` de explorer) sobre su Postgres, con los
datos que explorer había leído de `marcadores.rfef.es` a lo largo del
2026-11-01 (de 12:09Z a 20:51Z, 13 grupos, 170 partidos). Para capturarlas no
se hizo **ninguna** petición a la RFEF: solo lecturas de la base. Petición:
`Authorization: Bearer <RFEF_EXPLORER_TOKEN>` (el token nunca está en el
fixture ni en este README), respuesta `200`, `Content-Type:
application/json; charset=utf-8`, `Cache-Control: no-store`. En la misma
sesión se comprobaron el `401` sin Bearer y el `400` con fecha mal formada.

**Pendiente (CA-9):** la captura del endpoint desplegado en Vercel, cuando el
titular lo despliegue. Estas valen como contrato porque el código que sirve
el export es el mismo (`src/export/export-matches.ts` de explorer, leído de
Postgres en cada petición), pero no prueban el despliegue.

| Fichero | Petición | `exportedAt` | `date` | Filas | Contenido |
|---|---|---|---|---|---|
| `export-2026-10-31.json` | `?date=2026-10-31` | `2026-11-01T22:07:51.229Z` | 2026-10-31 | 42 | 33 `FINISHED` (14 de las cinco competiciones: 4 Primera, 4 Segunda, 4 Primera RFEF, 2 Segunda RFEF; el resto, femenino y juvenil), 9 `SCHEDULED`. Las 9 `SCHEDULED` son filas de Tercera y juvenil del panel de jornada, **con marcador** pero sin estado: el adaptador no les hace caso (ADR-023 §5) |
| `export-2026-11-01.json` | `?date=2026-11-01` | `2026-11-01T22:07:51.253Z` | 2026-11-01 | 78 | 27 `FINISHED`, 14 `LIVE_PROVISIONAL`, 37 `SCHEDULED`; 12 grupos: los cinco de D-3 (`33836085`, `33836087`, `33836089`, `33836092`, `26991073`) más juvenil (`26991075`, `26992215`, `33836117`) y femenino (`33836143`, `33836145`, `33836148`, `33836149`). 39 filas con `codEquipo*` null y 40 con `codActa` null (el panel no los da en Tercera ni en las filas de jornada). Nombres de Tercera en minúsculas y con comillas (`r.c. celta "B"`). Un mismo partido puede aparecer dos veces: la fila `SCHEDULED` del panel de jornada (sin `codActa`) y la fila con estado del panel de resultados |
| `export-2026-11-02.json` | `?date=2026-11-02` | `2026-11-01T22:07:51.269Z` | 2026-11-02 | 9 | solo `SCHEDULED` (Primera, Segunda y una de femenino): nada que observar |

## Lo que las capturas tienen y lo que no

- `export-2026-11-01.json`, cinco competiciones: 13 `FINISHED` (3 Primera,
  3 Segunda, 4 Primera RFEF, 3 Segunda RFEF) y 7 `LIVE_PROVISIONAL`. Con el
  kickoff del calendario declarado y la ventana de ADR-023 §5, solo dos salen
  `live` (Amorebieta–Gimnástica, `lastSeenAt` 18:12:37Z, kickoff 17:00Z;
  Extremadura–Unionistas, 20:42:37Z, kickoff 20:00Z); las otras cinco son
  filas vistas horas después de su kickoff (p. ej. Arenteiro–Céltiga, 12:00
  local, vista a las 20:50Z) y salen `skipped: ambiguous_state`. Tercera no da
  ninguna observación en las tres capturas: sus filas son `SCHEDULED` (el
  2026-10-31, con marcador) o `LIVE_PROVISIONAL` fuera de ventana.
- **No hay** `POSTPONED`, `SUSPENDED` ni `discardedReadings > 0` reales: ese
  día no hubo aplazados ni suspendidos y explorer no descartó ninguna lectura.
  `explorer.test.ts` deriva esos casos de filas reales mutadas en memoria y
  lo dice en el nombre del caso.
- `strategy` siempre es `static:*` o `none:scheduled`: ninguna fila resuelta
  por `vm` ni `playwright` (ADR-023, follow-ups).

## Alias

`data/alias/2026-27/rfef.json` resuelve todos los nombres de las cinco
competiciones de las tres capturas (`npm run alias:rfef -- --export <fichero>`
lista los que faltan: 0). `gran peña f.c.` (Tercera, J9 contra Villalbés)
apunta a `celta-c`, el id que el calendario declarado da a ese hueco en las
34 jornadas; el nombre del calendario («RC Celta C») es un follow-up de la
spec, no del alias.
