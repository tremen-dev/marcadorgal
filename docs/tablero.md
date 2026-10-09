<!-- GENERADO por tremen-sdd (scripts/tablero.mjs). NO EDITAR A MANO. -->
# Tablero

Actualizado: 2026-10-09

## EPIC-001 — cimientos (hecho)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-001 — esqueleto-ci-y-despliegue-con-pagina-de-espera | hecho | 2026-09-20 (sdd-verificador) |
| SPEC-002 — modelo-zod-migraciones-base-y-test-de-arquitectura | hecho | 2026-09-21 (sdd-verificador) |
| SPEC-003 — tokens-de-diseno-como-codigo-e-i18n | hecho | 2026-09-21 (sdd-verificador) |
| SPEC-004 — calendario-declarado-importador-y-cargador | hecho | 2026-09-21 (sdd-verificador) |

## EPIC-002 — ingesta-y-motor (hecho)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-005 — contrato-sourceadapter-registro-de-fuentes-y-adaptador-de-resultados-de-api-football | hecho | 2026-09-21 (sdd-verificador) |
| SPEC-006 — raw-store-en-storage-ventanas-por-partido-y-tick-de-ingesta | hecho | 2026-09-21 (sdd-verificador) |
| SPEC-007 — motor-de-decisiones-cualificador-y-alertas | hecho | 2026-09-21 (sdd-verificador) |
| SPEC-008 — despliegue-del-tick-pg-cron-vercel-cron-variables-y-sincronizacion-del-calendario | hecho | 2026-09-22 (sdd-verificador) |
| SPEC-009 — jornada-de-medicion-e-informe | hecho | 2026-09-29 (sdd-verificador) |
| SPEC-012 — la-monotonia-no-sobrevive-al-cierre-y-replay-de-la-jornada-medida | hecho | 2026-09-29 (sdd-verificador) |
| SPEC-013 — reconciliacion-del-marcador-despues-del-cierre-forzoso | hecho | 2026-10-06 (sdd-verificador) |
| SPEC-014 — rn-03-en-vivo-por-fuente-la-bajada-la-da-quien-subio-el-gol | hecho | 2026-10-06 (sdd-verificador) |
| SPEC-016 — rn-02-por-fuente-aplazado-y-suspendido-sin-operador | hecho | 2026-10-04 (sdd-verificador) |
| SPEC-018 — partido-sin-directo-prorroga-de-la-ventana-sen-sinal-en-scheduled-y-linea-del-informe | hecho | 2026-10-06 (sdd-verificador) |

## EPIC-003 — xornada-publica (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-019 — pantalla-xornada-movil-filas-estados-y-cualificadores-sobre-datos-de-demostracion | hecho | 2026-10-06 (sdd-verificador) |
| SPEC-020 — lectura-publica-y-snapshot-de-la-xornada-actual | hecho | 2026-10-08 (sdd-verificador) |
| SPEC-021 — descanso-dentro-de-live-del-adaptador-a-la-fila | en-revision | 2026-10-08 (sdd-implementador) |
| SPEC-023 — escritorio-tira-de-dias-filtros-y-plegar-competicion | hecho | 2026-10-08 (sdd-verificador) |
| SPEC-024 — realtime-fallback-y-frescura | hecho | 2026-10-09 (sdd-verificador) |
| SPEC-025 — medicion-de-latencia-gol-pantalla-con-segundo-reloj-y-sonda-sintetica | en-revision | 2026-10-09 (sdd-implementador) |
| SPEC-026 — primera-pintura-en-movil-con-3g | en-revision | 2026-10-09 (sdd-implementador) |
| SPEC-027 — navegar-entre-xornadas | aprobada | 2026-10-09 (Alberto Fojo) |

## EPIC-FIX (aprobada)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-011 — peticion-live-con-una-sola-competicion-y-errores-por-peticion-que-no-tiran-el-intento | hecho | 2026-09-23 (sdd-verificador) |
| SPEC-015 — el-calendario-declarado-llega-tarde-a-la-jornada | en-revision | 2026-09-29 (sdd-implementador) |
| SPEC-022 — test-db-no-toca-storage-de-produccion | hecho | 2026-10-08 (sdd-verificador) |

## EPIC-MANT — mantenimiento (borrador)

| Spec | Estado | Último cambio |
|---|---|---|
| SPEC-010 — salud-del-tick-sin-falsos-fallos-y-retirada-de-medir-directo | hecho | 2026-09-22 (sdd-verificador) |
| SPEC-017 — mejoras-del-informe-de-jornada | hecho | 2026-10-06 (sdd-verificador) |

## ADRs

| ADR | Estado | Título | Último cambio |
|---|---|---|---|
| ADR-001 | aprobada | stack | 2026-09-20 (Alberto Fojo) |
| ADR-002 | aprobada | arquitectura-de-datos-y-tiempo-real | 2026-09-20 (Alberto Fojo) |
| ADR-003 | aprobada | contrato-de-fuentes | 2026-09-20 (Alberto Fojo) |
| ADR-004 | aprobada | motor-de-decisiones-por-prioridad | 2026-09-20 (Alberto Fojo) |
| ADR-005 | aprobada | sistema-de-diseno-heredado | 2026-09-20 (Alberto Fojo) |
| ADR-006 | aprobada | esquema-base-y-acceso-a-datos-ids-append-only-version-de-decision-y-rls | 2026-09-20 (Alberto Fojo) |
| ADR-007 | aprobada | raw-store-en-supabase-storage-bucket-claves-escritura-y-retencion | 2026-09-21 (Alberto Fojo) |
| ADR-008 | aprobada | nucleo-de-ingesta-tick-autenticado-cadencia-concurrencia-y-puntos-de-enganche | 2026-09-21 (Alberto Fojo) |
| ADR-009 | aprobada | ejecucion-del-motor-enganche-por-observaciones-barrido-por-ausencia-y-precisiones-a-rn-02-rn-04 | 2026-09-21 (Alberto Fojo) |
| ADR-010 | aprobada | el-cierre-manda-sobre-la-monotonia-y-reconciliacion-tras-el-cierre-forzoso | 2026-09-29 (Alberto Fojo) |
| ADR-011 | aprobada | rn-03-en-vivo-baja-la-misma-fuente-que-subio-el-gol-u-otra-de-mas-peso | 2026-09-29 (Alberto Fojo) |
| ADR-012 | aprobada | rn-02-postponed-y-suspended-los-da-la-fuente-ganadora-con-cualificador-y-reversibles | 2026-10-04 (Alberto Fojo) |
| ADR-013 | aprobada | partido-sin-directo-de-la-fuente-prorroga-de-la-ventana-hasta-el-final-y-sen-sinal-en-scheduled | 2026-10-04 (Alberto Fojo) |
| ADR-014 | aprobada | entorno-de-produccion-y-acceso-publico-a-board | 2026-10-06 (Alberto Fojo) |
| ADR-015 | aprobada | login-de-la-web-en-supabase-residuo-de-public-en-net-y-tick-firmado | 2026-10-07 (Alberto Fojo) |
| ADR-016 | aprobada | segundo-reloj-de-medicion-instantes-sellados-por-la-base | 2026-10-09 (Alberto Fojo) |

## Resumen

- hecho: 22
- en-revision: 4
- aprobada: 1
