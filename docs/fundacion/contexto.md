# Contexto maestro — marcador.gal

> Documento vivo: TODO lo que un agente (o una persona) necesita para situarse.
> Se actualiza al cambiar el rumbo; la historia fina vive en ADRs y specs.
> Última actualización: 2026-09-29 (SPEC-009 y SPEC-012 hecho; SPEC-013 a falta de CA-5).

## Qué es y en qué punto está

Marcador de resultados en directo de las cinco divisiones españolas con equipos
gallegos (Primera, Segunda, Primera RFEF G1, Segunda RFEF G1, Tercera RFEF G1),
jornada completa, en una sola pantalla y en galego. Proyecto de tremen.dev.

**SPEC-001 completa:** esqueleto Next.js 16 con página de espera bilingüe (gl/es), CI con gates y e2e, tests unitarios con Vitest y e2e con Playwright.

**SPEC-002 completa:** modelo zod en `src/model/`, migraciones base aplicadas en `dev` (ocho tablas, vista `board`, RLS, extensiones pg_cron y pg_net), test de arquitectura.

**SPEC-003 completa:** tokens de diseño tipados en `src/design/tokens.ts`, CSS generado (`npm run tokens:css`) con test de paridad contra `docs/diseno/_tokens.css`, i18n tipada en `src/i18n/` con diccionarios de galego y español con tipos de `dominio.md`, reglas sin hex sueltos en `src/` y sin shorthand `font:` en CSS de `src/` (para preservar `font-variant-numeric: tabular-nums` en números).

**SPEC-004 completa:** calendario declarado en `data/calendario/2026-27/` (cinco competiciones, 1.834 partidos, nombres federativos), alias del proveedor en `data/alias/2026-27/`, importador de API-Football (`npm run calendario:sync`, `npm run calendario:load`, `npm run calendario:xornada`).

**SPEC-005 completa:** contrato `SourceAdapter` tipado, registro de fuentes validado con API-Football (prioridad 10, cadencia 30 s), adaptador de resultados con estados mapeados y minutos derivados, alias de partido (`fixture.id` → `id` derivado), fixtures reales de API-Football para tests sin red.

**SPEC-006 completa:** raw store en Supabase Storage con retención de 30 días, ventana por partido, tick autenticado registrando cada intento, alerta `unresolved_team`, manejo de cadencia con tolerancia de 5 s, enganche para el motor (`afterInsert`).

**SPEC-007 completa:** motor de decisiones puro en `src/decide/`, criterios de aceptación del decisor (RN-01..RN-06, monotonía, conflicto, silencio, cierre forzoso), adaptador `src/ingest/engine.ts` con las cuatro consultas, migración del quinto `AlertKind` (`forced_finish`), `lastHeard` para trazar el cierre sin confirmación, replay determinista, barrido por ausencia de observaciones.

**SPEC-008 completa:** despliegue del tick en producción con pg_cron cada 30 s (extensión 1.6.4) y Vercel Cron cada minuto como respaldo, secretos en Supabase Vault (`npm run cron:setup`), sincronización semanal del calendario por GitHub Actions (los martes y con PR solo si hay diff), `npm run tick:salud` como semáforo de vitalidad.

**SPEC-009 completa:** jornada real del 2026-09-25 al 28 (39 partidos, cuatro competiciones; Primera no jugó) medida sin intervención, con informe en `_qa/SPEC-009/`. Ingesta sana (0 intentos fallidos, cobertura 99,85 %, cadencia 30 s); veredicto `no válida (c2)` por defecto de **regla** (RN-03 retuvo 7 marcadores falsos). Latencia mediana +53 s contra el objetivo de 45 s. La fuente no da en directo 4 de 9 partidos de Tercera.

**SPEC-012 completa:** la monotonía no sobrevive al cierre (ADR-010 §1) y replay de la jornada aplicado en `dev`: 37 de 39.

**SPEC-013 (en revisión):** RN-12, reconciliación tras el cierre forzoso (ADR-010 §2); corrige los dos últimos partidos → **39 de 39**. Falta CA-5, que se mide con la jornada del 2026-10-02/04 (lectura el 2026-10-05).

**SPEC-014 (aprobada, empieza tras fusionar SPEC-013):** RN-03 en vivo por fuente (ADR-011): el marcador lo baja la misma fuente que subió el gol u otra de más peso. La medición de las bajadas en vivo (`_qa/ADR-011/`) mostró que retener publicó ~742 ticks de marcador falso.

EPIC-002 (ingesta y motor) **no cierra hasta que el marcador esté corregido** (N-9): cierra con SPEC-013 y SPEC-014 en `hecho`. PRs apilados: #16 (SPEC-009) → #17 (SPEC-012) → #18 (SPEC-013, borrador).

**EPIC-FIX (correcciones urgentes):** SPEC-011 hecho. Arregla dos defectos de la ingesta: sin peticiones `live=` con un solo id de liga, y `ParseResult` gana cuarto canal `requestErrors` para guardar observaciones buenas aun si una petición falla. Entrada prioritaria para fallos que dañan medición en vivo.

### Herencia

Existe una versión previa en `github.com/tremen-dev/marcador.gal` (2026-08-29 a
2026-09-12) que no llegó a publicarse. Construyó un motor de ingesta con pesos
de confianza, un bot de corresponsal y una pantalla por polling, pero nunca
corrió con datos reales porque no tenía fuente legal: futgal.es prohíbe el
rastreo y solo quedaba un agregador. De ella se hereda el sistema de diseño
íntegro, el modelo de dos logs inmutables (Observation y Decision), los cinco
estados de partido y los tres relojes de la frescura. Se descartan los pesos
de confianza, la doble fuente independiente, el bot con LLM, la radio con ASR y
el volumen documental. Esta versión cambia el orden: primero la fuente, luego
el motor, luego la pantalla.

## Stack y arquitectura (resumen; detalle en ADR-001 y ADR-002)

- Next.js 16 App Router, React 19, TypeScript estricto, zod 4, npm, Node 24.
- Supabase: Postgres (migraciones SQL con la CLI), Realtime Broadcast, Auth
  para el operador, Storage para el crudo. Dos proyectos: dev (Free) y prod
  (Pro). `postgres.js` sin ORM en el servidor; `supabase-js` solo en cliente.
- Vercel Pro: un proyecto, dominio marcador.gal, previews por PR.
- Ingesta: pg_cron llama cada 30 s a `POST /api/ingest/tick` vía pg_net; Vercel
  Cron cada minuto como respaldo. El tick solo sondea fuentes con partidos en
  ventana. Webhooks en `/api/sources/[id]/webhook`. Operador en `/operador`.
- Motor puro en `src/decide/`, ejecutado en el mismo request que inserta las
  observaciones.
- Navegador: primera pintura servida desde la vista `board`; después
  suscripción a Supabase Realtime Broadcast por jornada, con fallback a
  polling de `/api/board` cada 30 s. Sin SSE, sin colas.
- Calidad: Vitest, Playwright, Biome, GitHub Actions en cada PR.

## Fuentes

Registro en `src/sources/registry.ts`. Tipos soportados por el contrato: API de
proveedor (pull), web con acuerdo (pull), webhook (push), operador (push).
API-Football Pro está contratado desde 2026-09-21 y ya es el importador de
calendario. La verificación de cobertura de Tercera G1 (306 partidos, 34
jornadas, eventos con minuto) está hecha. Alternativas sin directo: Sportmonks
(sin directo en Segunda RFEF), BeSoccer API (sin precio público). La base legal
de cada fuente la gestiona el titular fuera del repo (D-7).

## Decisiones clave hasta hoy

- ADR-001 Stack.
- ADR-002 Arquitectura de datos y tiempo real: ingesta en Supabase, Broadcast
  al navegador, Vercel solo front.
- ADR-003 Contrato de fuentes `SourceAdapter` y registro.
- ADR-004 Motor de decisiones por prioridad, monotonía, conflicto y silencio.
- ADR-005 Sistema de diseño heredado, vinculante, con sus excepciones.
- ADR-006 Esquema base y acceso a datos: ids, append-only por trigger, versión de Decision, board, RLS.
- ADR-007 Raw store en Supabase Storage: bucket privado, gzip, retención de 30 días.
- ADR-008 Núcleo de ingesta: tick autenticado, cadencia, concurrencia, enganche del motor.
- ADR-009 Ejecución del motor: enganche por observaciones, barrido por ausencia, precisiones a RN-02 y RN-04.
- ADR-010 El cierre manda sobre la monotonía, y reconciliación tras el cierre forzoso (RN-12).
- ADR-011 RN-03 en vivo: baja la misma fuente que subió el gol u otra de más peso (sustituye la letra en vivo de ADR-010 §1).

## Riesgos y preguntas abiertas

- **pg_cron a 30 s.** Documentado como soportado; se comprueba en la primera
  spec de ingesta. Respaldo: Vercel Cron a 1 min.
- **Pico de conexiones Realtime** en un Celta-Depor. Plan Pro de Supabase da
  500; el exceso se factura. Se mide en la primera jornada pública.
- **Coste de plataforma al lanzar:** Vercel Pro 20 $ + Supabase Pro 25 $ +
  proveedor 19 $ ≈ 64 $/mes.
