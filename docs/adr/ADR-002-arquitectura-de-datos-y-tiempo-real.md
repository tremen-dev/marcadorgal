---
id: ADR-002
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-arquitecto}
---
# ADR-002: Arquitectura de datos y tiempo real

- Deciders: sdd-arquitecto propone; Alberto Fojo aprueba (2026-09-20).
- Specs relacionadas: EPIC-002 (ingesta), EPIC-003 (pantalla).

## Contexto

Las fuentes disponibles son todas de tipo sondeo (ningún proveedor asequible
ofrece push) con refresco de 10-15 s. Vercel no tiene proceso vivo: las
funciones mueren a los 800 s y no hay `LISTEN/NOTIFY`, así que SSE desde Vercel
es frágil (lo documentó la versión previa). Se evaluaron tres enfoques: sondeo
puro con Vercel Cron, ingesta en Supabase con push al navegador, y worker con
proceso vivo más cola.

## Decisión

1. **Scheduler en Supabase, código en Next.js.** pg_cron ejecuta cada 30 s una
   llamada con pg_net a `POST /api/ingest/tick` (token secreto). Vercel Cron
   llama al mismo endpoint cada minuto como respaldo. Un solo runtime (Node).
2. **El tick solo sondea lo que está en ventana** (kickoff − 10 min a
   kickoff + 150 min o `finished`). Fuera de ventana termina sin llamar a nadie.
3. **Tres entradas, una tabla.** Pull (tick), push (`/api/sources/[id]/webhook`)
   y operador (`/operador`) escriben `observations`. El motor corre en el mismo
   request, justo después, y escribe `decisions`.
4. **Crudo en Supabase Storage**, no en Postgres, con retención automática de
   30 días.
5. **Publicación por vista `board`** (Decision vigente por partido). Primera
   pintura servida por el servidor con `s-maxage=10, stale-while-revalidate=30`.
6. **Realtime por Broadcast, no Postgres Changes.** Un trigger en `decisions`
   publica un delta de ~200 bytes en un canal por jornada. Postgres Changes
   evalúa RLS por suscriptor y cambio; Broadcast es fan-out plano.
7. **Fallback a polling** de `GET /api/board` cada 30 s con ETag si el
   websocket no conecta. El aviso de desconexión vive fuera de la tabla (D-9).
8. **Sin colas ni SSE.** Si una fuente futura exige proceso vivo, se añade un
   worker externo que escriba en `observations`; nada más cambia.

## Consecuencias

### Positivas
Latencia extremo a extremo de 20-40 s. Vercel Hobby valdría; Pro se usa por el
cron de respaldo y el uso comercial. Dimensionado: 50 partidos, 500 navegadores,
~300.000 mensajes por fin de semana, dentro del plan gratuito de Realtime.

### Negativas / follow-ups
pg_cron a 30 s hay que verificarlo en la primera spec de ingesta. El pico de
conexiones se mide en la primera jornada pública. Supabase Free pausa
proyectos inactivos: producción va en Pro.

## Alternativas consideradas

- **Sondeo puro con Vercel Cron (A)**: latencia 60-90 s y cadencia limitada a
  1 min.
- **Worker vivo + cola (C)**: una máquina más que operar; la cola no resuelve
  nada que B no resuelva con una llamada por fuente.
- **Edge Functions de Supabase para los adaptadores**: segundo runtime (Deno)
  para el mismo código.
- **SSE desde Vercel**: reconexiones cada 800 s y memoria por conexión.
