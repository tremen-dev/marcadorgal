---
id: ADR-014
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-06, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-06, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-014: Entorno de producción y acceso público a board

- Deciders: sdd-arquitecto propone (2026-10-06) por el riesgo «Entorno» de EPIC-003. **Alberto Fojo decide H-1..H-4 en el gate del 2026-10-06, las cuatro con la recomendación del arquitecto.**
- Specs relacionadas: SPEC-020 (lectura pública y snapshot) y la de Realtime de EPIC-003 lo implementan. SPEC-019 no depende de él: define `PublicMatch`, que §3 cita. **Supersede ADR-006 §6** en la lectura de `anon` y `authenticated`. Precisa ADR-002 §6 (canal).

## Contexto

Todo corre sobre el proyecto Supabase `dev` (Free): tick de producción
(SPEC-008, a propósito), Vault, raw store y el histórico de la jornada medida.
ADR-001 y ADR-002 preveían un `prod` en Pro que no existe. ADR-006 §6 dio
`SELECT` a `anon` en cinco tablas, `observations` y `decisions` incluidas.
Con la pantalla, la clave `anon` va al navegador para Realtime: hoy daría a
cualquiera PostgREST sobre el log entero, sin límite de consultas, y, con un
canal Broadcast público, la capacidad de **emitir** deltas falsos a todos los
navegadores conectados.

## Decisión

1. **Un solo entorno remoto: el proyecto actual pasa a ser producción** y sube
   a Pro antes de la jornada publicada (criterio 1). Se renombra `prod`. El
   desarrollo y `test:db` van contra Supabase local (Docker, ya en uso). Las
   migraciones se siguen aplicando antes del merge y deben ser compatibles con
   el código desplegado (añadir antes de usar, retirar después). (H-1)
2. **El navegador no lee Postgres.** Ni PostgREST ni Postgres Changes. Se
   retiran las políticas `public_read` de las cinco tablas: con RLS activo,
   `anon` y `authenticated` no leen nada. D-6 no exige publicar el log: la
   Decision sigue sabiendo de qué observaciones sale. EPIC-004 da sus permisos
   al operador con su propio ADR. (H-2)
3. **Lo que ve el anónimo es `PublicMatch` (SPEC-019) y nada más**: partido,
   competición, jornada, kickoff, equipos (`name`, `shortName`), estado,
   marcador, minuto y añadido, cualificador, `version`, `observed_at` y
   `decided_at`. Nunca: fuente, regla, ids de observación, dueños del
   marcador, alertas ni crudo.
4. **Lectura del servidor con rol mínimo.** Vista `web.xornada` en un esquema
   que la API de Supabase no expone, con exactamente las columnas de §3, y rol
   de login `web_reader` con `SELECT` solo sobre ella. La primera pintura y
   `GET /api/board` usan `DATABASE_URL_PUBLIC` (`web_reader`), presente en
   Production **y Preview**: los previews enseñan datos reales sin poder
   escribir. `DATABASE_URL` (`postgres`) sigue solo en Production y solo lo
   usa el tick. (H-3)
5. **Realtime por Broadcast en canal privado** `board:<season>` (uno por
   temporada: la «jornada» de ADR-002 §6 no existe como conjunto entre
   competiciones). Un trigger `AFTER INSERT` en `decisions` publica la fila
   `PublicMatch` del partido con `realtime.send`. Política en
   `realtime.messages`: `anon` recibe en ese tema; nadie tiene `INSERT`, así
   que solo la base emite. El cliente descarta un delta con `version` menor o
   igual que la que ya pinta. (H-4)
6. **Carga acotada por caché.** Página y `/api/board` con
   `s-maxage=10, stale-while-revalidate=30` (ADR-002 §5) y `ETag` por máxima
   `version`: la base ve ~1 lectura por ruta, región y 10 s, haya diez
   espectadores o diez mil.
7. **Sin datos de quien mira.** `supabase-js` con `persistSession: false` y sin
   Auth en la pantalla pública: ni cookies ni almacenamiento.

## Consecuencias

### Positivas
La superficie pública es una lista de columnas declarada en un sitio. Un fallo
de la web no puede escribir ni leer el log. Nadie puede inyectar un marcador.
Ninguna llamada extra al proveedor ni datos que migrar.

### Negativas / follow-ups
25 $/mes desde la jornada publicada (ya previsto en ADR-001). Sin entorno
remoto de pruebas: una migración rota afecta al público; la mitiga §1 y
`test:db` local. Si algún día se quiere transparencia pública del log, vista
curada con su ADR. Pico de Realtime y coste: se miden en la jornada publicada.

## Alternativas consideradas

- **Proyecto `prod` nuevo y `dev` aparte**: o dos ticks (el doble de
  peticiones al proveedor, RN-08) o mudar cron, Vault, Storage e histórico
  para dejar un `dev` sin datos vivos. Coste sin beneficio con un operador.
- **Publicar desde `dev` en Free**: 200 conexiones Realtime, sin copias
  diarias; ADR-002 ya puso producción en Pro.
- **Mantener ADR-006 §6** (PostgREST para `anon`): consultas sin límite sobre
  el log y redistribución del dato del proveedor (D-7) sin consumidor en v1.
- **Canal Broadcast público**: cualquiera con la clave `anon` emite al canal.
- **`board` con `security_definer` en `public`**: ya rechazada en ADR-006;
  `web.xornada` evita la exposición por API, que era el motivo.
- **Leer como `postgres` también en la web**: una inyección o un error en la
  ruta pública tendría permisos de dueño.

## Para el titular (resuelto el 2026-10-06 por Alberto Fojo)

- **H-1 = sí.** El proyecto actual pasa a producción (Pro, renombrado) y `dev`
  pasa a ser local (§1).
- **H-2 = sí.** Se cierra la lectura anónima de las cinco tablas (§2).
- **H-3 = sí.** Rol `web_reader` y previews con datos reales de solo lectura (§4).
- **H-4 = sí.** Canal privado con política en `realtime.messages` (§5).
