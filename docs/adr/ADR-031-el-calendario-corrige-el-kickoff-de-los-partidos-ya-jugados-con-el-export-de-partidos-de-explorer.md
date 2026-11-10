---
id: ADR-031
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-031: El calendario corrige el kickoff de los partidos ya jugados con el export de partidos de explorer

- Deciders: sdd-arquitecto propone (2026-11-10); **Alberto Fojo (titular)** aprueba (2026-11-10) y decide: las correcciones se autofusionan como reprogramaciones puras (§3), y el `horaTexto` se copia tal cual, también en Tercera (§1).
- Specs relacionadas: SPEC-071 (lo ejecuta); SPEC-015 (bot del calendario); SPEC-070 (identidad); ADR-026 (explorer como importador del calendario).

## Contexto
El importador del calendario (`/api/export/calendar`, ADR-026) da horas de relleno a las jornadas sin horario, y `syncCalendar` no reescribe un kickoff pasado; Tercera ni siquiera se importa (el importador devuelve el fichero declarado). Resultado: 19 partidos jugados entre el 08-14 y el 11-09 tienen en `data/calendario/**` y en base un día que no es. El export de partidos (`/api/export/matches?date=`) sí sabe qué día y a qué hora se jugó cada uno.

## Decisión
1. El kickoff real de un partido declarado con kickoff pasado es `<fecha del export> <horaTexto>` (Europe/Madrid, a UTC con `Z`) de la única fila `FINISHED` que lo empareja con la identidad de SPEC-070 en una ventana de ±3 días Madrid. Ninguna otra fila corrige: ni `POSTPONED`, ni `SUSPENDED`, ni una ambigüedad.
2. La corrección la hace `calendario:sync` (el bot de SPEC-015) sobre los últimos 8 días, y a demanda desde una fecha (`--reales-desde`). Escribe en `data/calendario/**` (D-3) y llega a base por `calendario:load`; nada escribe `public.matches.kickoff` por otra vía.
3. Una corrección es una reprogramación pura del diff (`PASADO`): el bot la fusiona y la carga solo (SPEC-015 H-1). El `horaTexto` se copia tal cual, sin redondear, aunque no sea una hora programada (p. ej. 17:33 en Tercera).
4. El `isPast` de `syncCalendar` se mantiene para el importador: el pasado solo lo cambia esta corrección.

## Consecuencias
### Positivas
- La web pinta cada partido en su día, y el enriquecimiento por día encuentra su fila sin ventana.
- Tercera recibe horas reales, aunque solo a posteriori.
### Negativas / follow-ups
- ~15 peticiones más al export de explorer por ejecución del bot.
- Un aplazado sigue sin poder moverse a futuro una vez pasada su fecha (resto de F-SPEC-069-2).

## Alternativas consideradas
- **`historico:sync` escribe `public.matches.kickoff`**: rechazada; viola D-3 y el siguiente `calendario:load` la revierte.
- **Quitar `isPast` del importador**: rechazada; el importador no sabe si el partido se jugó y volvería a poner horas de relleno sobre horas buenas.
- **Herramienta manual aparte**: rechazada; el desfase reaparece en cada jornada sin horario y el bot ya tiene el flujo de PR, fusión y carga.
