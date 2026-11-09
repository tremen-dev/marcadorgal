---
id: SPEC-057
tipo: spec
epica: EPIC-003
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
---
# SPEC-057 — Panel de preferencias de ligas visibles e enlaces a clasificación en cabeceiras de columna

## Contexto y Problema
En SPEC-055 se integraron las competiciones de fútbol femenino y se introdujo el componente `CompetitionNav` en la cabecera superior de la portada (`/` y `/es`).
Sin embargo, esta disposición presenta varios inconvenientes de experiencia de usuario:
1. **Pérdida de jerarquía y protagonismo del logo:** La barra de navegación de ligas se sitúa por encima del logo `marcador▮gal` y la fecha de la jornada, desplazando el elemento identitario principal hacia abajo y rompiendo la inmediatez visual de la pantalla.
2. **Duplicidad de controles:** La portada ya muestra todas las columnas de la jornada simultáneamente, por lo que una barra de selección superior resulta redundante.
3. **Sobrecarga de columnas:** Con la incorporación de nuevas ligas (como `liga-f` y futuras divisiones femeninas), el número de columnas simultáneas crece en escritorio y alarga la lista en móvil. Determinados perfiles de aficionados tienen interés específico en seguir únicamente ciertas categorías (por ejemplo, solo fútbol femenino, o solo categorías modestas como 2ª y 3ª RFEF) y carecen de un mecanismo para personalizar qué ligas ver y recordar esa selección en su navegador.

Esta especificación resuelve estos puntos:
- Retira la barra superior de la portada para devolver la prioridad visual absoluta al logo y a la jornada.
- Añade enlaces directos y contextuales a la tabla de clasificación y calendario desde la cabecera de cada columna de la jornada (Opción A).
- Introduce un panel de preferencias accesible («⚙ Ligas») con interruptores toggle/switches por competición y botones de filtro rápido, cuya selección se persiste en `localStorage` (Alternativa 1).

## Usuarios / roles afectados
- **Afición y público general (móvil y escritorio, en gallego y castellano):**
  - Recuperan la portada limpia con el logo `marcador▮gal` presidiendo el inicio de la pantalla.
  - Pueden saltar a la clasificación y calendario de cualquier liga con un clic contextual desde la propia columna que están viendo.
  - Pueden personalizar qué ligas desean mantener visibles en pantalla (ocultando las que no sigan) con persistencia entre sesiones.

## Criterios de Aceptación

### CA-1 Restauración de la cabecera limpia en portada
- Se retira `CompetitionNav` de la parte superior de `HomeXornada` (`/` y `/es`).
- El primer elemento visual de la pantalla vuelve a ser el encabezado canónico `XornadaHeader`: logo `marcador▮gal`, título de la xornada (`Xornada · [fechas]`), tira de días (`DayStrip`), filtros de estado (`FilterPills`) y selector de idiomas `gl · es`.
- El componente `CompetitionNav` se preserva intacto en las páginas donde sí actúa como menú contextual: `/competicion/[id]`, `/clasificacion/[id]`, `/calendario/[id]` y `/directos`.

### CA-2 Enlace contextual en la cabecera de cada columna (Opción A)
- En `CompetitionSection.tsx`, la cabecera de cada columna (`styles.head` dentro de `<details>`) incorpora un acceso contextual hacia `/competicion/${competitionId}` (y `/es/competicion/${competitionId}` en castellano).
- El enlace se muestra de forma sutil y elegante (ej. etiqueta compacta `Táboa ↗` / `Clasificación ↗` o icono accesible):
  - No interfiere con la interacción nativa del `<summary>` para plegar y desplegar la columna. Al hacer clic en el enlace de clasificación se navega a la página de competición sin alterar el estado de plegado.
  - Cumple con accesibilidad: `aria-label` descriptivo indicando la competición de destino, contraste cromático según diseño y compatibilidad con teclado (`Enter`, `Tab`).

### CA-3 Panel de preferencias de ligas visibles («⚙ Ligas»)
- Se añade un disparador discreto y accesible en la interfaz de controles (por ejemplo, botón con icono de ajustes / selector `⚙ Ligas` o `Filtro de ligas` con `data-testid="leagues-preferences-trigger"`).
- Al pulsar el disparador, se abre un diálogo o popover flotante minimalista (`role="dialog"`, `aria-modal="true"`, soporte de cierre con tecla `Escape` o clic exterior):
  - **Interruptores toggle / switches:** Uno por cada competición reconocida en el sistema (`liga-f`, `primera-division`, `segunda-division`, `primera-rfef-g1`, `segunda-rfef-g1`, `tercera-rfef-g1`, así como las futuras femeninas cuando estén disponibles).
  - Cada switch incluye el nombre de la competición y su etiqueta distintiva (ej. `· Depor ABANCA`, `· As Celtas`).
  - **Accesos rápidos (Presets):**
    - `Todas`: activa todas las competiciones.
    - `Só feminino`: activa únicamente las competiciones femeninas.
    - `Só modesto / RFEF`: activa 1ª RFEF, 2ª RFEF y 3ª RFEF.
    - `Só profesional`: activa 1ª y 2ª División.
  - El panel valida que al menos una competición permanezca seleccionada (no se permite desmarcar todas para evitar una pantalla vacía sin contenido).

### CA-4 Persistencia en almacenamiento del navegador (`localStorage`)
- Las preferencias de visibilidad se guardan en el cliente bajo una clave versionada: `marcadorgal:preferences:visible-leagues:v1`.
- Si no existe valor previo en `localStorage`, la configuración por defecto es **todas las ligas visibles** (`all`).
- Al modificar cualquier switch en el panel, la vista de columnas en la portada actualiza su visibilidad de forma inmediata en el DOM sin requerir recarga de la página (`location.reload()`).

### CA-5 Resiliencia SSR, hidratación y soporte sin JavaScript
- **Server-Side Rendering (SSR):** El servidor renderiza todas las competiciones activas en el HTML inicial, preservando el indexado, la disponibilidad y la compatibilidad cuando JavaScript está desactivado (`javaScriptEnabled: false`).
- **Hidratación limpia:** Al cargar en el navegador, el cliente lee `localStorage` y aplica la visibilidad sin causar discrepancias de hidratación en React ni parpadeos destructivos de layout.
- Si `localStorage` no está disponible o bloqueado por políticas de privacidad del navegador, el sistema opera con el valor por defecto sin lanzar excepciones no controladas.

### CA-6 Calidad, Diseño y Pruebas
- **Regla `no-hex`:** Todos los estilos y colores del panel respetan los tokens CSS del sistema (`src/design/tokens.ts`, `Xornada.module.css`), sin valores `#hex` directos.
- **Figuras tabulares (`tabular-nums`):** Todos los números y contadores incluidos en el panel cumplen con la regla de alineación numérica.
- **Bilingüismo:** Textos del panel y accesos disponibles en gallego (`src/i18n/gl.ts`) y castellano (`src/i18n/es.ts`).
- **Verificación:** Ejecución satisfactoria de `npm run gates` (typecheck, linting Biome, vitest y compilación Next.js) y suite de pruebas e2e de Playwright.
