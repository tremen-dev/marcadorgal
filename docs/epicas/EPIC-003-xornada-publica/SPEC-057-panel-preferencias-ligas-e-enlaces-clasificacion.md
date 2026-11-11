---
id: SPEC-057
tipo: spec
epica: EPIC-003
estado: hecho
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-11, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-orquestador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-orquestador}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-11-11, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-11-11, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-11, por: sdd-verificador}
aprobada-por: Alberto Fojo
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
- El enlace está tras el interruptor `SHOW_TABLE_LINK` (`src/app/config.ts`), **apagado por defecto**.
- Apagado (defecto, sin variable o con valor no verdadero): ninguna columna pinta el enlace (0 enlaces a `/competicion/` desde las columnas de la portada).
- Encendido (`SHOW_TABLE_LINK=true`): cada columna de `CompetitionSection.tsx`, junto a su cabecera y fuera del `<summary>`, enlaza a `/competicion/${competitionId}` (y `/es/competicion/${competitionId}` en castellano), con etiqueta compacta por i18n (`Táboa ↗` / `Tabla ↗`):
  - Pulsarlo navega sin alterar el estado de plegado. Con la columna plegada el enlace no se ve; es aceptado (el `<summary>` queda como único control, sin interactivos anidados).
  - Accesibilidad: `aria-label` por i18n que nombra la competición de destino, contraste según diseño y teclado (`Tab` llega, `Enter` navega).

### CA-3 Panel de preferencias de ligas visibles («⚙ Ligas»)
- Se añade un disparador discreto y accesible en la interfaz de controles (por ejemplo, botón con icono de ajustes / selector `⚙ Ligas` o `Filtro de ligas` con `data-testid="leagues-preferences-trigger"`).
- Al pulsar el disparador, se abre un diálogo o popover flotante minimalista (`role="dialog"`, `aria-modal="true"`, soporte de cierre con tecla `Escape` o clic exterior):
  - **Interruptores toggle / switches:** Uno por cada competición reconocida en el sistema (`liga-f`, `primera-division`, `segunda-division`, `primera-rfef-g1`, `segunda-rfef-g1`, `tercera-rfef-g1`, así como las futuras femeninas cuando estén disponibles).
  - Cada switch incluye el nombre de la competición, resuelto por su `nameKey` en el idioma de la página (en `/es`, nombre en castellano), y su etiqueta distintiva (ej. `· Depor ABANCA`, `· As Celtas`).
  - **Accesos rápidos (Presets)**, en una barra con `aria-label` por i18n (paridad gl/es); etiquetas por i18n, en gl:
    - `Todas`: activa todas las competiciones.
    - `Feminino`: activa únicamente las competiciones femeninas.
    - `RFEF / Galegas`: activa 1ª RFEF, 2ª RFEF y 3ª RFEF.
    - `Profesional`: activa 1ª y 2ª División.
  - El panel valida que al menos una competición permanezca seleccionada (no se permite desmarcar todas para evitar una pantalla vacía sin contenido).

### CA-4 Persistencia en almacenamiento del navegador (`localStorage`)
- Las preferencias de visibilidad se guardan en el cliente bajo una clave versionada: `marcadorgal:preferences:visible-leagues:v1`.
- Si no existe valor previo en `localStorage`, la configuración por defecto es **todas las ligas visibles** (`all`).
- Al modificar cualquier switch en el panel, la vista de columnas en la portada actualiza su visibilidad de forma inmediata en el DOM sin requerir recarga de la página (`location.reload()`).

### CA-5 Resiliencia SSR, hidratación y soporte sin JavaScript
- **Server-Side Rendering (SSR):** El servidor renderiza todas las competiciones activas en el HTML inicial, preservando el indexado, la disponibilidad y la compatibilidad cuando JavaScript está desactivado (`javaScriptEnabled: false`).
- **Hidratación limpia:** Al cargar en el navegador, el cliente lee `localStorage` y aplica la visibilidad sin causar discrepancias de hidratación en React ni parpadeos destructivos de layout.
- Si `localStorage` no está disponible o su mero acceso lanza (p. ej. `SecurityError` por almacenamiento bloqueado), toda lectura y escritura va en `try/catch`: la portada carga entera con todas las ligas visibles, el panel sigue operando en memoria y no hay excepción no controlada.

### CA-6 Calidad, Diseño y Pruebas
- **Tokens (D-8):** Todo color del panel, incluidos los de cada liga, sale de tokens de `src/design/tokens.ts`; ni `#hex` ni `rgb()`/`hsl()` literales en código o estilos en línea.
- **Figuras tabulares (`tabular-nums`):** Todos los números y contadores incluidos en el panel cumplen con la regla de alineación numérica.
- **Bilingüismo:** Todo texto visible o accesible (`aria-label` incluido) del panel, presets y enlace sale de `src/i18n/gl.ts` y `src/i18n/es.ts` con paridad de claves; sin literales en componentes.
- **Tests automatizados:** CA-1, CA-2 (apagado y encendido), CA-3 (switches con nombre por idioma, presets, última liga) y CA-5 (sin JS y almacenamiento bloqueado) tienen al menos un test (unitario de componente o e2e) cada uno, además de los de CA-4.
- **Verificación:** Ejecución satisfactoria de `npm run gates` (typecheck, linting Biome, vitest y compilación Next.js) y suite de pruebas e2e de Playwright.

> **Enmienda 2026-11-11** (sdd-arquitecto, tras verificación RED; decisiones del titular): CA-2 recoge `SHOW_TABLE_LINK` apagado por defecto y acepta que el enlace no se vea con la columna plegada (F-2); CA-3 adopta los presets `Feminino`, `RFEF / Galegas`, `Profesional` y exige nombres por `nameKey` y `aria-label` por i18n (F-4); CA-5 concreta el almacenamiento bloqueado (F-1); CA-6 exige tokens para colores de liga (F-3), i18n con paridad (F-4) y tests de CA-1/2/3/5 (F-5).
