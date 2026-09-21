---
id: EPIC-001
tipo: epica
estado: hecho
historial:
  - {estado: borrador, fecha: 2026-09-20, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-09-20, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-09-21, por: sdd-orquestador}
  - {estado: en-revision, fecha: 2026-09-21, por: sdd-orquestador}
  - {estado: hecho, fecha: 2026-09-21, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# EPIC-001 — Cimientos

## Objetivo

Que exista un proyecto desplegable, probado y con datos de referencia sobre el
que construir la ingesta (EPIC-002) y la pantalla (EPIC-003) sin volver a tocar
infraestructura. La versión previa construyó motor y pantalla sobre cero datos
reales y sin CI; esta épica invierte el orden: primero el cauce completo, de
`git push` a marcador.gal, y el calendario de las cinco competiciones en base de
datos.

## Criterios de éxito

1. `npm run gates` (typecheck, lint, test, build) pasa en GitHub Actions en
   cada PR y en `main`.
2. Un push a `main` despliega en https://marcador.gal una página de espera en
   galego y castellano, con `noindex`, servida con el sistema de diseño (tokens
   como código, Geist autoalojada, solo oscuro).
3. La base de datos de Supabase `dev` tiene aplicadas las migraciones base
   (`competitions`, `teams`, `matches`, `observations`, `decisions`, `alerts`)
   con sus invariantes en SQL: append-only en `observations` y `decisions`,
   cinco estados de partido como CHECK.
4. El calendario declarado de las cinco competiciones de D-3 para la 2026-27
   está en `data/calendario/2026-27/` y cargado en `dev`: una consulta devuelve
   los partidos de la jornada en curso de las cinco. Origen de los datos:
   hipótesis a validar, el proveedor candidato; se revisa a mano.
5. El modelo zod de `src/model/` es la única definición de Competition, Team,
   Match, Observation y Decision, y sus tests de ida y vuelta pasan.
6. Un test de arquitectura falla si `src/sources/*` importa algo fuera de
   `src/model`.

## Alcance

- Dentro: esqueleto Next.js 16 con las convenciones de ADR-001; CI; proyecto
  Vercel con dominio y variables por entorno; proyecto Supabase `dev` con
  migraciones por CLI; modelo zod; tokens de diseño como código y test de
  paridad con `docs/diseno/_tokens.css`; i18n con estructura y una sola
  cadena por idioma; calendario declarado y su cargador; página de espera.
- Fuera (aparcado a propósito, no por descuido): cualquier adaptador de fuente,
  el tick, el motor, Realtime, la pantalla Xornada, el panel de operador,
  Supabase `prod`, alias de equipos por fuente. Todo eso es EPIC-002 en
  adelante.

## Specs

<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

Desglose orientativo, a decidir por sdd-arquitecto: (a) esqueleto, CI y
despliegue con página de espera; (b) modelo zod, migraciones base y test de
arquitectura; (c) tokens de diseño como código e i18n; (d) calendario
declarado y cargador.

## Riesgos

- El calendario de Tercera G1 en el proveedor candidato puede estar incompleto
  o con nombres no canónicos: por eso se revisa a mano antes de cargar.
- El dominio marcador.gal está en Dinahosting; apuntarlo a Vercel exige tocar
  DNS fuera del repo.
- pg_cron y Realtime no se prueban aquí; si Supabase `dev` no los ofrece como
  se espera, se descubre en EPIC-002, no antes. Aceptado.
