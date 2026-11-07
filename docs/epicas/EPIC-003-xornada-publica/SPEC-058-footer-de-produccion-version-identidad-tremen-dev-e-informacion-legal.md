---
id: SPEC-058
tipo: spec
epica: EPIC-003
estado: hecho
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-07, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-07, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-07, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-11-07, por: sdd-verificador}
---
# SPEC-058 — Footer de producción: versión, identidad tremen.dev e información legal sin cookies

## Contexto y Problema
Actualmente, `marcador.gal` no dispone de un pie de página (`footer`) en la aplicación. Para la puesta en producción pública es imprescindible contar con:
1. **Identificación legal y regulatoria (LSSI-CE y RGPD):** En España y la Unión Europea, cualquier servicio web público requiere identificar al prestador/titular (Alberto Fojo Eiras / `tremen.dev`), un canal de contacto y las condiciones de uso, incluyendo la exención de responsabilidad sobre exactitud de marcadores deportivos y la desvinculación absoluta de casas de apuestas deportivas.
2. **Política de privacidad y declaración sobre cookies:** De conformidad con la constitución del proyecto (`FOUNDATION.md` no-negociable: *«Sin cookies, sin analítica de terceros, sin datos de quien mira la pantalla pública»*), no se utilizan cookies de seguimiento ni publicidad comportamental, por lo que no se requiere banner intrusivo de consentimiento, pero sí una página informativa que certifique esta garantía de privacidad y el uso exclusivo de almacenamiento local técnico (`localStorage`) para preferencias.
3. **Gestión y visualización de versiones:** Exponer la versión de la aplicación para soporte, auditoría y trazabilidad en producción.
4. **Firma e identidad de estudio `{tremen.dev}`:** Reconocimiento de marca con el formato y estilo visual característico del estudio.
5. **Canal de contacto protegido contra spam:** El buzón `ola@tremen.dev` debe proporcionarse para avisos de erratas, aficionados y medios, pero protegiendo la dirección contra raspadores automáticos de correo (harvesting bots).

## Usuarios / roles afectados
- **Visitantes y afición (móvil y escritorio):** Disponen de navegación hacia los textos legales, contacto directo, información de versión y garantías de privacidad sin cookies de rastreo ni banners molestos.
- **Titular y operadores:** Cumplimiento normativo estricto sin comprometer la velocidad ni la estética limpia de la web.

## Criterios de Aceptación

### CA-1 Componente Footer y maquetación responsive (`src/components/layout/Footer.tsx`)
- Se implementa el componente `Footer` y sus estilos en `src/components/layout/Footer.module.css`.
- Se incorpora en los layouts raíz (`src/app/(gl)/layout.tsx` y `src/app/(es)/es/layout.tsx`), mostrándose al final de todas las vistas públicas.
- Maquetación adaptativa:
  - En pantallas estrechas / móvil: distribución vertical limpia con enlaces táctiles holgados.
  - En pantallas anchas / escritorio: fila equilibrada alineada con la rejilla y el ancho de la aplicación.
- Respeta estrictamente D-8:
  - Solo utiliza tokens de diseño de `src/design/tokens.ts` (`--bg`, `--line`, `--fg`, `--fg-muted`, `--fg-dim`, `--marca`).
  - No utiliza ningún valor hexadecimal fuera de los tokens.
  - No utiliza el shorthand CSS `font:` (declara longhands para preservar `font-variant-numeric: tabular-nums`).

### CA-2 Identidad y lockup de `{tremen.dev}`
- Se incluye la firma de autoría:
  - En gallego: `Un proxecto de {tremen.dev}`
  - En castellano: `Un proyecto de {tremen.dev}`
- El lockup de `{tremen.dev}` reproduce fielmente la identidad del estudio:
  - Enlace seguro hacia `https://tremen.dev` con `target="_blank"` y `rel="noopener noreferrer"`.
  - Las llaves `{` y `}` y la terminación `.dev` en tipografía monospace (`--mono`) con el color de acento (`--marca`).
  - La palabra `tremen` en `var(--sans)` con color `--fg`.

### CA-3 Gestión de Versión de la Aplicación (`src/lib/version.ts`)
- Se crea el módulo `src/lib/version.ts` que exporta:
  - `APP_VERSION`: versión semántica sincronizada desde `package.json` (ej. `0.1.0`).
  - Formato visible en el pie de página: `v{APP_VERSION}` (con soporte para hash corto de commit si existe en variables de entorno de compilación).

### CA-4 Buzón de contacto con protección anti-spam (`MailboxLink`)
- Dirección oficial: `ola@tremen.dev`.
- Protección activa contra raspadores de spam (email harvesting):
  - No se inserta un enlace `mailto:` en texto plano indexable en el HTML estático sin protección.
  - Se utiliza una técnica de ofuscación (por ejemplo, ofuscación con entidades/ensamblado cliente mediante dataset o script) y se acompaña de texto visible legible para humanos (`ola [en] tremen.dev` o renderizado al interactuar).
  - Incluye advertencia explícita en las páginas legales de que el canal es exclusivamente para afición, medios e incidencias y no acepta comunicaciones comerciales ni publicidad.

### CA-5 Páginas legales estáticas e i18n bilingüe (D-2)
- Se implementan las páginas estáticas bajo rutas dedicadas:
  - En gallego: `/aviso-legal`, `/privacidade`, `/cookies`
  - En castellano: `/es/aviso-legal`, `/es/privacidad`, `/es/cookies`
- Los contenidos beben de las bases aprobadas en los proyectos de `tremen.dev` (`stockeiro` SPEC-035, `marcador.gal` y `todo-o-futbol-galego.html`):
  - **Aviso Legal:** Titular (Alberto Fojo Eiras, persona física), naturaleza informativa deportiva no oficial, desvinculación de casas de apuestas y federaciones.
  - **Privacidade:** Navegación anónima, ausencia de rastreo y analíticas de terceros, cumplimiento RGPD.
  - **Cookies:** Declaración formal de que la web no utiliza cookies de rastreo publicitario ni analítica externa; uso exclusivo de almacenamiento local técnico (`localStorage`) para preferencias (idioma y filtros de ligas).
- Todos los textos visibles viven en `src/i18n/gl.ts` y `src/i18n/es.ts`.

### CA-6 Calidad y verificación automática
- Tests unitarios y de arquitectura comprobando:
  - Renderizado del footer con enlaces válidos en ambos idiomas.
  - Veracidad y carga de los textos legales sin dependencias de base de datos (`module pure`).
  - Presencia del lockup de `tremen.dev` y número de versión.
  - `npm run gates` (typecheck, lint, vitest y build) en verde.

## Entidades y reglas afectadas
- `FOUNDATION.md` (D-1, D-2, D-7, D-8).
- `src/components/layout/Footer.tsx`, `Footer.module.css`.
- `src/lib/version.ts`, `src/lib/legal/`.
- `src/app/(gl)/layout.tsx`, `src/app/(es)/es/layout.tsx`.
- Rutas legales en `src/app/(gl)/` y `src/app/(es)/es/`.
- `src/i18n/gl.ts` y `src/i18n/es.ts`.

## Fuera de alcance
- Sistema de registro de usuarios o sesiones en la web pública.
- Formularios interactivos complejos con backend (el contacto es directo por correo electrónico).
