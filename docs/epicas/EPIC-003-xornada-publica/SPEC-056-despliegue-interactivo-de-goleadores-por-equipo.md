---
id: SPEC-056
tipo: spec
epica: EPIC-003
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
---
# SPEC-056 — Despliegue interactivo de goleadores por equipo e identificación de goleador reciente

## Contexto y Problema
En SPEC-055 se incorporó el modelo `PublicGoal` y el renderizado estático de goles embebidos procedentes de la API Explorer v2.0 (`MatchRow.tsx`). Sin embargo, en el dashboard actual:
1. Los goleadores se muestran en un bloque plano y siempre visible debajo del partido, ocupando espacio vertical de forma indiscriminada.
2. No se organizan de forma clara por cada equipo (local vs visitante).
3. No existe interactividad de despliegue (click o tap).
4. Cuando un equipo marca un gol reciente y se activa el pulso o la pastilla «GOL» de SPEC-041, el goleador específico que acaba de marcar no se destaca respecto a los anteriores.

## Usuarios / roles afectados
- Afición y público general (móvil y escritorio, en gallego y castellano): consulta rápida y limpia del marcador, con la posibilidad de desplegar bajo demanda los goleadores de un partido y reconocer de inmediato quién acaba de marcar.

## Criterios de aceptación
- **CA-1 Interacción de despliegue condicional (Click / Tap).**
  - Si el partido tiene goles registrados (`row.goals && row.goals.length > 0`), al hacer click o tap sobre la fila del partido (`MatchRow`), se conmuta (`expanded / collapsed`) el cajón de goleadores hacia abajo.
  - Si el partido no tiene goles registrados (`!row.goals || row.goals.length === 0`, incluye 0-0, partidos sin comenzar o partidos sin eventos disponibles): el click o tap no produce ninguna acción ni efecto colateral.
  - La fila con goles muestra `cursor: pointer` y un sutil indicador visual (flecha/chevron o micro-afordance) de contenido desplegable. Las filas sin goles mantienen `cursor: default`.
  - Accesibilidad (a11y): La fila interactiva incorpora `role="button"`, `tabIndex={0}`, `aria-expanded={isOpen}`, `aria-controls` y soporte de activación por teclado (`Enter` y `Espacio`).
- **CA-2 Distribución y alineación por equipo.**
  - El cajón desplegable organiza los goleadores en dos grupos diferenciados: equipo local (`home`) y equipo visitante (`away`).
  - En vista de escritorio, los goles locales se alinean con el bloque local y los visitantes con el visitante; en móvil estrecho, se presentan ordenados y claramente atribuidos a cada contendiente.
  - Cada entrada incluye el minuto del gol con el formato `[minuto]'` (p. ej. `23'`), seguido del nombre del futbolista y los distintivos estándar `(p.)` para penaltis y `(p.p.)` para goles en propia puerta.
- **CA-3 Identificación del goleador reciente.**
  - Si la marca de gol reciente está activa para un equipo (según `recentGoals(row, now, minutes)` de SPEC-041: `recent.home !== null` o `recent.away !== null`), el último gol registrado de dicho equipo se marca visualmente como **reciente**.
  - El goleador reciente recibe un distintivo destacado (píldora «GOL» o punto/pulso animado usando `--directo` o `--marca`), sincronizado con la ventana de caducidad (`until`) del reloj del cliente, cesando de pulsar al expirar sin recargar la página.
  - Respeta `prefers-reduced-motion: reduce` (estático sin animación).
- **CA-4 Renderizado SSR y apertura fluida.**
  - La estructura DOM de los goles se renderiza en el servidor dentro de la fila (con estado colapsado inicial mediante CSS/`data-expanded`) para preservar el SEO, la inmediatez de respuesta y los tests de marcado estático.
  - El despliegue/repliegue se realiza mediante transición suave de altura en CSS sin saltos bruscos de maquetación (*layout shifts*).
- **CA-5 Calidad, tokens de diseño y gates.**
  - Sin valores hexadecimales crudos: uso estricto de variables de `src/design/tokens.ts` (`--line`, `--line-row`, `--bg-step`, `--fg-muted`, `--directo`).
  - Sin uso de la propiedad shorthand `font:`.
  - Textos de accesibilidad localizados en `src/i18n` (`gl.ts` y `es.ts`).
  - `npm run gates` (typecheck, lint, vitest y build de producción Next.js) en verde al 100%.

## Entidades y reglas afectadas
- `MatchRow.tsx`, `Xornada.module.css`, `view.ts` (`XornadaRow`), `recent-goal.ts`, `goals.test.ts`.
- D-8 (Diseño y tokens), ADR-005, SPEC-041 (Goles recientes), SPEC-055 (Goles embebidos).

## Fuera de alcance
- Asistencias de gol, tarjetas y sustituciones (requiere ampliación del contrato del proveedor de eventos).
- Persistencia en almacenamiento local del estado abierto/cerrado de cada fila entre recargas completas.
