---
id: SPEC-043
tipo: spec
epica: EPIC-MANT
estado: en-progreso
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-11-02, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-02, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-11-02, por: sdd-implementador}
---
# SPEC-043 — Migraciones automáticas al fusionar

## Problema
Las migraciones de `supabase/migrations` se aplican a mano (`npm run db:push`,
`tools/db-push.mjs`). Vercel promueve cada commit de `main` solo; si el código
llega antes que su migración, la web rompe: SPEC-041 (PR #85) cambia
`web.xornada` y el código nuevo con la vista vieja deja la portada vacía.
Petición del titular (2026-11-02): que se apliquen solas al fusionar. Decisión
en ADR-024 (precisa ADR-014 §1).

## Usuarios / roles afectados
Titular (deja de aplicar a mano); público de marcador.gal (no ve una portada
rota); sdd-implementador y sdd-verificador (regla de compatibilidad, ADR-024 §3).

## Criterios de aceptación
- **CA-1 Workflow válido.** Dado `.github/workflows/migraciones.yml` (job
  `migraciones`), cuando corre `actionlint` (versión fijada en el ledger) sobre
  `.github/workflows/`, entonces sale 0 sin avisos.
- **CA-2 Disparo, orden y guardia.** Disparadores: `push` a `main` sin filtro de
  rutas y `workflow_dispatch` con input `modo` ∈ {`dry-run`, `aplicar`}, por
  omisión `dry-run`. `concurrency: {group: migraciones-prod,
  cancel-in-progress: false}`; `permissions: contents: read`;
  `timeout-minutes` ≤ 10; CLI de Supabase con versión fijada. Dado un dispatch
  `modo=aplicar` con `--ref` distinto de `main`, cuando corre, entonces falla
  antes de cualquier paso que conecte (run rojo en el ledger).
- **CA-3 Secreto y nada impreso.** Único secreto: `DATABASE_URL` (H-3), por
  `env`, nunca interpolado en `run:`. Antes de la CLI, un paso enmascara
  (`::add-mask::`) host, usuario y contraseña sin escribirlos. Dado el log de
  cada run de CA-2/4/5 (`gh run view --log`), cuando se busca con `grep -cF`
  cada parte de la URL del `.env` local, entonces todas cuentan 0.
- **CA-4 Dry-run real.** Dado `main` con la base al día, cuando se lanza el
  dispatch `modo=dry-run`, entonces el run sale verde, el log dice qué está
  pendiente (o que está al día) y `supabase migration list` contra producción
  es idéntico antes y después.
- **CA-5 Ejecución real y orden.** Dada la PR de esta spec con una migración
  inocua (`comment on schema web is …`), cuando se fusiona, entonces el run de
  `push` la aplica, `migration list` la muestra aplicada y el despliegue de
  producción de ese SHA pasa a *Current* en Vercel **después** de que el check
  `migraciones` termine (marcas de tiempo de `gh run view` y del panel o
  `vercel inspect`). Un dispatch `aplicar` posterior sobre el mismo SHA sale
  verde sin aplicar nada (idempotencia).
- **CA-6 Fallo no despliega.** Ningún paso tiene `continue-on-error` ni `|| true`;
  los `run:` usan `shell: bash` (pipefail): un `db push` no-cero deja el check
  en rojo. Vercel tiene `migraciones` como Deployment Check obligatorio de
  producción (captura en `_qa/SPEC-043/`). Evidencia: lectura del YAML, run rojo
  de CA-2 y la documentación de Vercel citada en el ledger. No se provoca un
  fallo real contra producción.
- **CA-7 Commits sin `push`.** El paso de fusión automática de
  `calendario-semanal.yml` lanza también
  `gh workflow run migraciones.yml --ref main -f modo=aplicar` (ya tiene
  `actions: write`), para que el commit fusionado con `GITHUB_TOKEN` tenga
  check y se promueva. Verificación: lectura del YAML y actionlint (CA-1).
- **CA-8 Gates y vía manual.** `npm run gates` sale 0; `npm run db:push` sigue
  existiendo; `docs/fundacion/contexto.md` dice que las migraciones se aplican
  al fusionar y que `db:push` es la vía de emergencia.

## Entidades y reglas afectadas
ADR-024 (decisión); ADR-014 §1 (un solo entorno remoto, que es producción;
`test:db` solo local por SPEC-020/SPEC-022: no hay `dev` remoto que mantener
al día); ADR-001 (stack). Ninguna RN ni entidad de dominio.

## Fuera de alcance
`test:db` en CI (sigue local, SPEC-002 N-7); entorno remoto de staging;
comprobación automática de compatibilidad hacia atrás (ADR-024 §3 la deja al
verificador); rollback automático de migraciones.

## Notas para el gate humano
Recomendación: ADR-024 (migrar en cada push a `main` + Deployment Check de
Vercel que retiene la promoción). CA-2 (run), CA-4 y CA-5 solo se verifican
tras fusionar: `workflow_dispatch` exige el fichero en `main`. La verificación
va en dos tiempos: estática antes de la PR, real justo después.
- **H-1 ¿Deployment Checks de Vercel?** Recomiendo sí. Mano humana: marcar el
  check `migraciones` en Vercel → Settings → Deployment Checks antes de
  fusionar. Si el plan no lo ofrece, plan B de ADR-024 con `VERCEL_TOKEN`.
- **H-2 PR #85 (SPEC-041).** Recomiendo no fusionarla hasta que CA-5 esté en
  verde; si urge antes, `npm run db:push` a mano justo antes de fusionar.
- **H-3 ¿Mismo `DATABASE_URL` u otro propio?** Recomiendo el mismo (rol
  `postgres`, ya usado por `db:push` y el job `load`). Si es la URL del pooler
  en modo transacción y la CLI falla, crear `DATABASE_URL_MIGRACIONES`
  (conexión directa o pooler de sesión).
- **H-4 ¿Aprobación manual por environment de GitHub?** Recomiendo no: un clic
  por fusión anula la petición.
- **H-5 Aviso de fallo.** Recomiendo el correo por defecto de GitHub Actions al
  autor del push; sin canal nuevo.
