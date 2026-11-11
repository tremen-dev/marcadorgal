---
id: ADR-037
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-11, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-12, por: Alberto Fojo}
---
# ADR-037: Funciones de Vercel en dub1, junto a la base

- Deciders: sdd-arquitecto propone (2026-11-11) a raíz de la petición del titular de mejorar el tiempo de carga; aprobado por Alberto Fojo (titular) el 2026-11-12; Explorer se queda en cdg1.
- Specs relacionadas: SPEC-085 (la consume, CA-1); SPEC-026 (primera pintura, criterio 4 de EPIC-003); ADR-014 §6 (caché), ADR-021 §6 (IP estática del adaptador rfef directo), ADR-023 (explorer).

## Contexto
Nadie eligió región: las funciones corren en la de defecto de Vercel. Medido el 2026-11-11 desde Galicia con `curl` a producción (cabecera `X-Vercel-Id`):

| Pieza | Región |
|---|---|
| Funciones de marcador.gal (`/`, `/es`, `/xornada/*`, `/api/board`, el tick) | **iad1** (Washington) |
| Supabase (pooler `aws-1-eu-west-1`) | Irlanda |
| Explorer (`marcadorgal-explorer.vercel.app`) | cdg1 (París) |
| Borde que sirve al público gallego | cdg1 |

Cada render en fallo de caché cruza el Atlántico varias veces: la conexión de `postgres.js` al pooler (TCP + TLS + SCRAM, ~5 viajes en frío), dos consultas encadenadas (`readHome`: índice y filas) y las llamadas a Explorer (goleadores, calendario y partidos de las ligas femeninas). *Hipótesis:* ~80 ms por viaje iad1↔Irlanda/París frente a ~5–20 ms dentro de Europa. Tiempos medidos en `MISS`: `/` 1,9–3,5 s, `/es` 1,7–1,8 s, `/xornada/2026-10-31` 1,9–2,2 s, `/api/board` 2,2–2,6 s; en `HIT`, 0,13–0,23 s. El presupuesto entero de la primera pintura con 3G es 2 s (`vision.md`).

## Decisión
1. **Todas las funciones del proyecto corren en `dub1` (Dublín)**, la región de Vercel junto a `eu-west-1`. Se declara en el repo: `vercel.json` → `"regions": ["dub1"]`; nada se toca a mano en el panel.
2. **Una sola región.** La base es una y está en Irlanda: varias regiones solo acercarían el cómputo al lector y lo alejarían de la base.
3. **El tick se muda con la web.** La Vercel Cron llama a la misma función; la ingesta gana los mismos viajes (escritura en la base, Explorer en cdg1 a ~20 ms).
4. **Se comprueba en producción**, no se supone: tras el despliegue, `X-Vercel-Id` de un `MISS` de `/` contiene `::dub1::` (SPEC-085).

## Consecuencias
### Positivas
- Se recorta el tramo dominante del fallo de caché sin tocar código de render ni la caché de ADR-014 §6.
- El tick y la lectura pública pagan menos latencia por consulta y por conexión.
### Negativas / follow-ups
- ADR-021 §6 (IP de salida estática «función fijada a su región») solo rige el adaptador rfef **directo**, hoy sin uso (ADR-023 §2 lo supersede para la vía explorer). Si vuelve, su spec elige IP para `dub1`.
- *Hipótesis:* el cambio de región no tiene coste en Pro con una región. Se confirma en el panel antes de aprobar.
- Las sondas de SPEC-025 y SPEC-026 cambian de punto de partida: comparar antes y después solo con la misma herramienta.

## Alternativas consideradas
- **cdg1 (París)**, junto a Explorer: deja la base a ~20 ms por viaje, y la base hace más viajes por render que Explorer (conexión en frío + dos consultas). Peor por poco; aceptable si `dub1` diera problemas.
- **Quedarse en iad1** y tapar con caché: el fallo de caché sigue costando ~2 s y con poco público casi toda visita tras 40 s sin tráfico es fallo. Rechazada.
- **Varias regiones**: más coste y una base única al otro lado. Rechazada.
- **Mover la base**: migrar Supabase es un proyecto, no un ajuste. Rechazada.
