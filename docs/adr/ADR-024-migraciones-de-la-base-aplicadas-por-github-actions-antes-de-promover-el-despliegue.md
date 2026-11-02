---
id: ADR-024
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
---
# ADR-024: Migraciones de la base aplicadas por GitHub Actions antes de promover el despliegue

- Deciders: sdd-arquitecto propone (2026-11-02) a petición de Alberto Fojo («que las migraciones se apliquen solas al fusionar en main»). Pendiente de su aprobación (SPEC-043 H-1..H-5).
- Specs relacionadas: SPEC-043 lo implementa. **Precisa ADR-014 §1**: «las migraciones se siguen aplicando antes del merge» pasa a «se aplican al fusionar, antes de promover»; el resto de §1 (un solo entorno remoto, `test:db` en local, migraciones compatibles con el código desplegado) sigue en pie.

## Contexto

Hay un solo proyecto Supabase remoto y es producción (ADR-014 §1); el secreto
`DATABASE_URL` de GitHub apunta a él (lo usa el job `load` de
`calendario-semanal.yml`). Las migraciones se aplican a mano con
`npm run db:push`. Vercel construye y promueve a producción cada commit de
`main` por la integración Git. Si el código llega antes que su migración, la
web lee una forma de `web.xornada` que no existe: SPEC-041 (PR #85) añade
columnas a la vista y el código nuevo con la vista vieja deja la portada vacía.

## Decisión

1. **Un workflow `migraciones`** aplica `supabase/migrations` a producción en
   cada push a `main` (y por `workflow_dispatch`) con `supabase db push`,
   idempotente: sin pendientes no hace nada. Corre en todo push, haya o no
   migraciones nuevas, porque su check es el que libera el despliegue (§2).
2. **El orden lo garantiza Vercel.** El check `migraciones` es *Deployment
   Check* obligatorio del proyecto en Vercel: el despliegue de producción de un
   commit se construye pero no se promueve hasta que el check de ese commit
   sale verde. Si falla, producción sigue sirviendo el despliegue anterior,
   compatible con la base por §3.
3. **Expandir antes de usar, contraer después** (se mantiene de ADR-014 §1).
   Entre la migración y la promoción el código viejo convive con el esquema
   nuevo: toda migración debe ser compatible con el código desplegado. Quitar o
   renombrar algo se hace en dos PR: primero deja de usarse, luego se retira.
4. **Una migración a la vez**: concurrencia por grupo fijo, sin cancelar la que
   está en curso. Nada imprime la URL ni sus partes: host, usuario y contraseña
   se enmascaran antes de invocar la CLI.
5. `npm run db:push` queda como vía manual de emergencia, no como la ordinaria.

## Consecuencias
### Positivas
Ningún despliegue de producción sirve código cuya migración no esté aplicada.
Nadie tiene que acordarse de `db:push`. Cada migración aplicada queda en el log
de Actions junto a su commit.

### Negativas / follow-ups
Cada promoción espera al workflow (~1-2 min). Una migración rota bloquea toda
promoción hasta que otra PR la arregle (es lo buscado). Un commit sin check (la
fusión del calendario con `GITHUB_TOKEN` no dispara `push`) no se promovería:
SPEC-043 lanza el workflow a mano desde ese job. La regla §3 no la comprueba
ninguna máquina; la revisa el verificador de cada spec con migración.

## Alternativas consideradas
- **Desactivar el despliegue automático de Vercel y desplegar desde Actions**
  (`vercel deploy --prod` tras migrar): mismo orden, pero añade `VERCEL_TOKEN`,
  ids de proyecto y un segundo camino de despliegue que mantener. Plan B si
  Deployment Checks no está disponible (SPEC-043 H-1).
- **Aplicar al abrir o aprobar la PR**: una PR que no se fusiona deja
  producción con un esquema que ningún código de `main` conoce, y dos PR
  abiertas se pisan.
- **Migrar después de desplegar confiando en la compatibilidad**: no cubre el
  caso que motiva esto (código nuevo con vista vieja).
- **Seguir a mano**: depende de memoria humana; es lo que se quiere quitar.
