# Contexto maestro — marcador.gal

> Documento vivo: TODO lo que un agente (o una persona) necesita para situarse.
> Se actualiza al cambiar el rumbo; la historia fina vive en ADRs y specs.
> Última actualización: 2026-10-12 (EPIC-003 a falta de SPEC-025/026; EPIC-004 fuente RFEF abierta; SPEC-030, 033 y 034 en producción).

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

**SPEC-013 completa (desplegada el 2026-10-03):** RN-12, reconciliación tras el cierre forzoso (ADR-010 §2); corrige los dos últimos partidos → **39 de 39**. CA-5 medido: 8 de 8 cierres forzosos reconciliados en ≤ 30 min (mediana 263 s).

**SPEC-016 completa (PR #27):** `postponed` y `suspended` los da la fuente ganadora, `provisional` y deshacibles (ADR-012); antes RN-02 los reservaba a federación u operador y un aplazamiento real (`sabadell-andorra`, 2026-10-03) se quedaba en `scheduled`.

**SPEC-014 completa (PR #32, fusionado el 2026-10-06):** RN-03 en vivo por fuente (ADR-011): el marcador lo baja la misma fuente que subió el gol u otra de más peso. La medición de las bajadas en vivo (`_qa/ADR-011/`) mostró que retener publicó ~742 ticks de marcador falso. Añade a `decisions` el dueño de cada lado y la marca `forced_finish`.

**SPEC-018 completa (PR #33, fusionado el 2026-10-06):** partido sin directo de la fuente (ADR-013): prórroga de la ventana hasta kickoff + 6 h con sondeo cada 5 min por `ids=`, `sen_sinal` también en `scheduled` (sin alerta) y línea `sin directo y sin final: N` en el informe. Enmienda N-4 (F-SPEC-018-6): un `live` o cierre forzoso decidido en la prórroga sigue en ventana para que RN-12 oiga el final. CA-7 ejecutado por el titular: `bergantinos-coruxo` 3-1 y `barco-pontevedra-b` 1-0.

Migraciones de SPEC-014 y SPEC-018 aplicadas en `dev`.

**EPIC-002 (ingesta y motor) cerrada el 2026-10-06 (`hecho`)** con sus 10 specs (005-009, 012-014, 016, 018).

**EPIC-003 (xornada pública) en curso, aprobada el 2026-10-06.** Quedan SPEC-025 y SPEC-026 en revisión. Ya están hechas:
- **SPEC-019:** contrato `PublicMatch`, `buildXornada` y la pantalla móvil sobre la demo `/demo/xornada`, que da 404 en producción.
- **SPEC-020:** `web.xornada` y el rol `web_reader`. `/` y `/es` sirven la xornada actual con `noindex`, y `/api/board` sale con ETag y 10 s de caché (ADR-015: pg_cron firma el tick).
- **SPEC-021:** el descanso como `halfTime` dentro de `live`, desde el adaptador hasta la fila.
- **SPEC-023:** escritorio con tira de días, filtros y plegado por competición.
- **SPEC-024:** Realtime por Broadcast con fallback a polling y línea de frescura. Un fallo de transporte nunca se pinta como estado del partido.
- **SPEC-027:** navegación entre xornadas en `/xornada/[fecha]`, con flechas ‹ ›.
- **SPEC-028:** el lateral lleva a su competición, el logo vuelve al inicio y la xornada mirada tiene título visible.
- **SPEC-033:** orden cronológico puro (el `live` ya no sube arriba) y cabecera discreta por día, oculta al elegir un día en la tira. Los equipos gallegos se declaran en `data/galegos/<temporada>.json`, uno por línea en `GALICIAN_SEASONS` cada temporada, y se marcan con 600 y `--marca`. También añade favicon e iconos.
- **SPEC-034:** `provisional` se pinta según `PROVISIONAL_DISPLAY`, en `src/app/config.ts`. Hay tres modos: `label`, `mark` (el `*` más una leyenda al pie, el modo por defecto) y `hidden`. `sen_sinal` conserva siempre su etiqueta.

Las mediciones de SPEC-025 (latencia gol→pantalla con el segundo reloj de ADR-016) y SPEC-026 (primera pintura con 3G) son de campo, del 16 al 19 de octubre. Pendiente: credenciales de producción en el entorno Preview de Vercel (F-SPEC-020-12).

**EPIC-004 (fuente RFEF), aprobada el 2026-10-10:** `marcadores.rfef.es` entra como segunda fuente con prioridad 50 para dar directo donde hoy hay `sen sinal`. La rigen ADR-017 (decodificación cerrada del marcador ofuscado, estados por marca y reloj) y ADR-018 (petición por POST, cuerpo vacío como error, respuesta rancia). SPEC-031 está hecha: adaptador en `src/sources/rfef/` sobre fixtures reales, todavía sin registrar. SPEC-032 (calibración con series de campo) está en su rama.

**EPIC-MANT — SPEC-017 completa (PR #31):** mejoras del informe de jornada, entre ellas el contraste con crudo propio (`--contrastar`). **SPEC-029 completa:** endurece `web_reader`, purga el cron y pasa a v7.

**EPIC-FIX (correcciones urgentes):** SPEC-011 hecho. Arregla dos defectos de la ingesta: sin peticiones `live=` con un solo id de liga, y `ParseResult` gana cuarto canal `requestErrors` para guardar observaciones buenas aun si una petición falla. Entrada prioritaria para fallos que dañan medición en vivo. **SPEC-022 completa:** `test:db` ya no toca Storage de producción. **SPEC-030 completa (PR #64, 2026-10-12):** `/` y `/es` dejan ISR y pasan a `force-dynamic`. La CDN las cachea con `Vercel-CDN-Cache-Control: s-maxage=10, stale-while-revalidate=30`, porque en Vercel la página dinámica sale `private, no-store` y el `Cache-Control` de `next.config` no basta. El cliente pide `/api/board` al hidratar si `servedAt` tiene más de 45 s. Medido en producción con `npm run cache:portada`: 10 de 10, sin HTML del build.

**EPIC-FIX — SPEC-015 en revisión (falta CA-5 de campo):** el calendario declarado se sincroniza de martes a sábado y las reprogramaciones puras se aplican solas; corrigió las horas de relleno de Segunda J8 y Tercera J5 antes de jugarse.

**Pendiente de la jornada 2026-10-09/12** (la primera con las cinco competiciones):
- Residual CA-8 de SPEC-018: medir las peticiones de la prórroga (≤ 42 por tanda; F-SPEC-018-2).
- Prueba de campo de `--contrastar` de SPEC-017 (CA-1/CA-2).
- CA-5 de SPEC-015.
- F-SPEC-013-6: repetir la lectura de RN-12 tras el cierre forzoso.
- R-SPEC-009-1: comprobar que Primera produce Decisions.

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
  para el operador, Storage para el crudo. Un proyecto remoto (producción,
  Pro antes de la jornada publicada) y Supabase local para desarrollo (ADR-014). `postgres.js` sin ORM en el servidor; `supabase-js` solo en cliente.
- Vercel Pro: un proyecto, dominio marcador.gal, previews por PR.
- Ingesta: pg_cron llama cada 30 s a `POST /api/ingest/tick` vía pg_net; Vercel
  Cron cada minuto como respaldo. El tick solo sondea fuentes con partidos en
  ventana. Webhooks en `/api/sources/[id]/webhook`. Operador en `/operador`.
- Motor puro en `src/decide/`, ejecutado en el mismo request que inserta las
  observaciones.
- Navegador: primera pintura renderizada por petición desde `web.xornada` y cacheada 10 s por la CDN (SPEC-030); después
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
- ADR-012 RN-02: `postponed` y `suspended` los da la fuente ganadora, con cualificador y reversibles.
- ADR-013 Partido sin directo de la fuente: prórroga de la ventana hasta +6 h y `sen_sinal` en `scheduled`.
- ADR-014 Entorno y acceso público: el proyecto Supabase actual pasa a producción (desarrollo y `test:db` en local), el navegador no lee Postgres, el público ve solo `PublicMatch` vía `web.xornada` y rol `web_reader`, Realtime por Broadcast privado. Supersede ADR-006 §6. Por decisión del titular (2026-10-07) Supabase sigue en Free hasta la jornada publicada.
- ADR-015 Login de la web en Supabase: `web_reader` conserva un residuo no revocable de PUBLIC (pg_net en `net`, funciones de `pg_catalog`), sin datos ni escritura en tablas; el disparador de pg_cron firma el tick con HMAC (±60 s) y la llave no sale de Vault.
- ADR-016 Segundo reloj de medición: instantes sellados por Postgres (`clock_timestamp()`); el código no lo lee para decidir.
- ADR-017 Fuente RFEF: panel de marcadores, decodificación cerrada y estados por marca y reloj.
- ADR-018 Fuente RFEF: el panel por POST, el cuerpo vacío como error y la respuesta rancia (sustituye ADR-017 §1).

## Riesgos y preguntas abiertas

- **pg_cron a 30 s.** Documentado como soportado; se comprueba en la primera
  spec de ingesta. Respaldo: Vercel Cron a 1 min.
- **Pico de conexiones Realtime** en un Celta-Depor. Plan Pro de Supabase da
  500; el exceso se factura. Se mide en la primera jornada pública.
- **Coste de plataforma al lanzar:** Vercel Pro 20 $ + Supabase Pro 25 $ +
  proveedor 19 $ ≈ 64 $/mes.
