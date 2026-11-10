---
id: ADR-032
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-11-10, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-11-10, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-032: Las alertas internas de los workflows son un issue de GitHub por incidente

- Deciders: sdd-arquitecto propone (2026-11-10); Alberto Fojo (titular) aprueba (pendiente).
- Specs relacionadas: SPEC-075 (lo ejecuta, para el bot del calendario); SPEC-074 / F-SPEC-074-2 (origen).

## Contexto
El bot del calendario falló en 13 ejecuciones programadas seguidas sin que el titular lo supiera (SPEC-075). El único aviso existente es el email que GitHub manda, por cada ejecución fallida, al último que tocó el cron. Ese email depende de quién hizo el último commit en el workflow, se repite en cada ejecución y no deja rastro de cuándo empezó ni de cuándo acabó el fallo. El proyecto tiene un solo humano y ningún canal interno: Buffer/X (EPIC-007, ADR-030) es público y sirve para goles, no para alertas.

## Decisión
1. Un workflow que necesita avisar al titular lo hace con un **issue de GitHub** abierto con `GITHUB_TOKEN` (`issues: write`), sin secretos nuevos.
2. **Un incidente = un issue abierto**, identificado por una etiqueta propia del vigilado (p. ej. `bot-calendario`). Mientras está abierto, cada ejecución nueva solo **edita** su cuerpo, que no notifica. Solo notifican la apertura, asignada al titular, y el cierre con comentario.
3. El issue **se cierra solo** cuando todas sus causas vuelven a `ok`. Un fallo posterior abre un issue nuevo: el historial de incidentes es la lista de issues cerrados con esa etiqueta.
4. La decisión (abrir, actualizar, cerrar o nada) es una función pura, testada sin red. Las llamadas a `gh` van en un ejecutor fino con el `gh` inyectable.

## Consecuencias
### Positivas
- Un email al empezar y otro al acabar, independiente de quién tocó el cron. El incidente queda en el repo con sus ejecuciones enlazadas.
- Cero secretos y cero servicios nuevos. El patrón vale para el siguiente workflow que quiera avisar.
### Negativas / follow-ups
- El email depende de la configuración de notificaciones de GitHub del titular.
- Si GitHub no corre nada (schedules deshabilitados, caída de Actions), nadie avisa. Eso exige un vigía externo, que queda fuera.

## Alternativas consideradas
- **Email de fallo nativo de GitHub Actions**: ya existía y no funcionó. Avisa una vez por ejecución, solo al último que tocó el cron, y no dice cuándo se resuelve el fallo.
- **Un comentario por ejecución fallida en el mismo issue**: 13 emails en este incidente. Es el spam que se quiere evitar.
- **Slack, Telegram o email por SMTP**: exigen secretos y cuentas nuevas para un único destinatario.
- **Buffer/X (EPIC-007)**: canal público. Una alerta interna no se publica.
- **Monitor externo (healthchecks.io o similar)**: es lo único que detecta que Actions no corre. Exige una cuenta y un secreto nuevos. Se aplaza hasta que ese caso muerda.
