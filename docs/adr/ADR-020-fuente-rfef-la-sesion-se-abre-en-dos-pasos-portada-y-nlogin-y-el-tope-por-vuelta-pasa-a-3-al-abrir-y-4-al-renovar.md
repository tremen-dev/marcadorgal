---
id: ADR-020
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-10-12, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-12, por: Alberto Fojo}
aprobada-por: Alberto Fojo
---
# ADR-020: Fuente rfef: la sesión se abre en dos pasos (portada y NLogin) y el tope por vuelta pasa a 3 al abrir y 4 al renovar

- Deciders: sdd-arquitecto propone (2026-10-12) a encargo del orquestador, tras el defecto de campo de la serie de calibración del 2026-10-12. Aprobado por **Alberto Fojo** el 2026-10-12: tope 4 al renovar (con reintento) y portada `200` vacía como `empty body`.
- Specs relacionadas: SPEC-032 (enmienda E-1: arregla `adapter.ts` y la calibración), SPEC-031 (terminal; esta vía corrige su CA-7 (ii)) y la spec de alta de EPIC-004. **Supersede solo** la apertura y la renovación de sesión de **ADR-019 §1** y el «GET a la portada para la sesión» de **ADR-018 §1**. El POST, su cuerpo, el crudo y ADR-019 §2-§7 no cambian. Evidencia: `docs/epicas/EPIC-004-fuente-rfef/_qa/calibracion/2026-10-12-handshake.md` y `2026-10-12.jsonl`.

## Contexto
La serie de calibración del 2026-10-12T19:16:48Z paró en la vuelta 1: la
portada respondió `302` y el POST `todos`, `302` a `NLogin`. No era un bloqueo
(eso da `200` con 0 B). El diagnóstico con curl (19:17–19:18Z, el mismo UA)
muestra que la sesión necesita **tres** pasos:

1. `GET /pnfg/` sin cookie → `302`, `Set-Cookie: JSESSIONID=…; Path=/pnfg`,
   `Location: /pnfg/NLogin` (se visitó `/pnfg/NLogin?NSess=1`).
2. `GET` a ese `NLogin` con la cookie → `302`, `Location: https://marcadores.rfef.es/pnfg/`.
   La sesión queda activa.
3. `POST` al panel con la cookie → `200`, 18.771 B.

ADR-018 y ADR-019 daban por hecho que la cookie de la portada ya valía. Las
series del 2026-10-11 se hicieron con curl siguiendo redirecciones, así que
el paso 2 quedaba oculto. Los dobles de los tests aceptaban la cookie
directamente.

## Decisión
1. **Apertura de sesión = 2 peticiones.** (a) `GET` a la portada sin cookie y
   con `redirect: "manual"`. Debe responder 3xx con `JSESSIONID` y un `Location`
   cuyo path sea `/pnfg/NLogin` en el mismo origen. (b) `GET` a ese `Location`,
   tal cual y con su query, con la cookie, el UA del registro y
   `redirect: "manual"`. Debe responder 3xx con un `Location` que no vuelva a
   `NLogin`. Si (b) trae otra `JSESSIONID`, sustituye a la anterior. No se
   sigue la redirección final a la portada. Cualquier otra respuesta es un
   **fallo de sesión** (`fetch` lanza; la calibración para), salvo un `200`
   con cuerpo vacío, que es el bloqueo (ADR-018 §3) y cuenta para el backoff
   (ADR-019 §4).
2. **Renovación** (sustituye la «portada + un reintento» de ADR-019 §1). Si el
   POST responde 3xx o `NLogin`: apertura completa (§1, 2 peticiones) y **un**
   reintento del POST. Si rebota el POST que sigue a una apertura recién
   hecha, no se renueva: es un fallo de sesión.
3. **Tope por vuelta** (sustituye «nunca más de 3» de ADR-019 §1):

   | Vuelta | Peticiones |
   |---|---|
   | Normal (sesión viva) | 1: POST |
   | Abre sesión (la primera, o sin sesión guardada) | 3: portada, NLogin, POST |
   | Renueva (el POST rebota) | 4: POST, portada, NLogin, POST |

   Nunca más de 4. El adaptador sin almacén de sesión (SPEC-031, aún sin
   registrar) abre sesión en cada intento: 3 peticiones por intento.
4. Ni la cookie ni el `Location` de `NLogin` van al crudo ni al registro. Solo
   se captura el POST del panel (ADR-018 §2).

## Consecuencias
### Positivas
La sesión se abre como la abre un navegador. Una vuelta normal sigue costando 1
petición. El coste medio por vuelta casi no cambia, porque abrir y renovar son
raros.
### Negativas / follow-ups
- La apertura cuesta una petición más: 3 en la primera vuelta y 4 en una
  renovación. La calibración (SPEC-032) mide con este patrón, así que su C\*
  ya lo incluye.
- Si la RFEF cambia el handshake (otro paso, otra ruta), la apertura falla de
  forma visible, como fallo de sesión, y nunca con un marcador falso.
- Los dobles de test deben **exigir** el paso `NLogin` (SPEC-032 E-1).

## Alternativas consideradas
- **Renovar sin reintento** (tope 3 también al renovar): la vuelta que renueva
  se queda sin datos y el hueco llega a 2·C\*, para ahorrar una petición en un
  caso raro. Rechazada, salvo que el titular prefiera el tope 3 (H-1 de E-1).
- **`redirect: "follow"`**: `fetch` no guarda cookies entre redirecciones ni
  expone el `Set-Cookie` de un 302 intermedio. La sesión no se abriría.
- **URL de `NLogin` fija en el código** (`/pnfg/NLogin?NSess=1`): si cambia la
  query, se rompe en silencio. Seguir el `Location` es seguir al servidor.
