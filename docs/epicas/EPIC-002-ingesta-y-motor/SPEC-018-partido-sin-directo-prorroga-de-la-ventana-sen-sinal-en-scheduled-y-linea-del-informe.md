---
id: SPEC-018
tipo: spec
epica: EPIC-002
estado: en-revision
aprobada-por: Alberto Fojo
historial:
  - {estado: borrador, fecha: 2026-10-04, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-10-04, por: Alberto Fojo}
  - {estado: en-progreso, fecha: 2026-10-06, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-10-06, por: sdd-implementador}
---
# SPEC-018 — Partido sin directo: prórroga de la ventana, `sen_sinal` en `scheduled` y línea del informe

## Problema
En Segunda RFEF y Tercera, la fuente a veces no da un partido en directo: lo
mantiene en `NS` y publica el `FT` entre +125 y +236. Desde el 2026-09-25 hay
8 casos. En los 8, mientras se jugaba, `board` dijo «por jugar»; 2 de ellos
(`bergantinos-coruxo` y `barco-pontevedra-b`) publicaron el `FT` después de
+150 y se quedaron `scheduled` sin salida
(`_qa/fuente-sin-directo/medicion.md`). Esta spec ejecuta **ADR-013 §1-§4**
con H-1..H-6 decididas.

## Usuarios / roles afectados
- **Público** (EPIC-003): deja de ver «por jugar» en un partido que se juega o
  ya acabó.
- **Titular:** lee el informe de jornada y paga las peticiones.

## Criterios de aceptación
- **CA-1 La verdad dice lo que ADR-013 fija.** Tres sitios:
  - En `dominio.md`, **Ventana** lleva la letra de ADR-013 §1.
  - En `reglas.md`, **RN-05** lleva la letra de §2 y la nota `*Enmendada el <fecha> por ADR-013.*`.
  - En `dominio.md`, **Cualificador** dice que `sen_sinal` vale en `live` o en `scheduled` con kickoff pasado.

  Test: `src/arch/reglas-rn05.test.ts` compara RN-05 con la cita de ADR-013, como `reglas-rn03.test.ts`.
- **CA-2 Prórroga de la ventana.** En `src/ingest/window.ts`, constantes nuevas en `constants.ts` (`EXTENSION_AFTER_MINUTES = 360`, `EXTENSION_POLL_MINUTES = 5`):
  - Un partido sigue en ventana entre +150 y +360 solo si su Decision vigente es `scheduled` o no tiene Decision.
  - `windowKickoffRange` extiende `from` hasta now − 360 min.
  - Una función pura nueva decide si toca consulta: dentro de la prórroga, solo si su última observación es de hace ≥ 5 min.

  Tests en `window.test.ts`:
  - (i) `scheduled` a +200 → en ventana.
  - (ii) a +360 → fuera.
  - (iii) `live`, `finished`, `postponed` o `suspended` a +200 → fuera.
  - (iv) a +200 con la última observación de hace 2 min → no toca; de hace 5 min → toca.
  - (v) entre −10 y +150 todo igual que hoy.
- **CA-3 La prórroga solo pide por `ids=`.**
  - Un partido en prórroga no añade su competición a `live=`.
  - Si el tick solo tiene partidos de prórroga y a ninguno le toca consulta, no hay intento ni petición.
  - Varios partidos de prórroga van en un solo `ids=`.

  Tests en `tick.test.ts` con `fetch` doble: tres partidos en prórroga a los que les toca → 1 petición `ids=` con los tres y ninguna `live=`. Ninguno con observación de hace < 5 min.
- **CA-4 `sen_sinal` en `scheduled` (RN-05).** En `src/decide/engine.ts`, con `now` inyectado. Vigente `scheduled`, `now ≥ kickoff + 15 min` y ninguna observación fresca `live`, `finished`, `postponed` ni `suspended` → Decision `scheduled`, `RN-05`, `sen_sinal`, **sin alerta**, citando las observaciones vigentes.

  Tests en `engine.test.ts`:
  - (i) a +14 → nada.
  - (ii) a +15 con observaciones `scheduled` → `sen_sinal` y 0 alertas.
  - (iii) una observación `scheduled` posterior **no** le quita `sen_sinal` (sin parpadeo).
  - (iv) llega `finished` → `finished provisional RN-01`.
  - (v) llega `live` → `live` y su cualificador normal; en `live`, RN-05 sigue igual que hoy, con alerta.
  - (vi) `postponed` vigente → nada.
- **CA-5 Modelo y migración.**
  - El `refine` de `Decision` (`src/model/entities.ts`) admite `sen_sinal` con `status` `live` o `scheduled`.
  - Una migración cambia `decisions_sen_sinal_check` a `status in ('live','scheduled')`.

  Tests: `model.test.ts` («sen_sinal only when live» se invierte para `scheduled` y sigue rechazando `finished`, `postponed` y `suspended`) y `engine.db.test.ts` (ida y vuelta de un `scheduled · sen_sinal`, con rollback). La etiqueta i18n de `sen_sinal` (gl `sen sinal`, es `sin señal`) no cambia.
- **CA-6 Informe de jornada.**
  - El bloque 6 imprime **una** línea `sin directo y sin final: N`, con la muestra de `enLinea`. Cuenta los partidos con kickoff + 150 en la ventana del informe, vigente `scheduled`, ninguna observación `live` y ninguna `postponed`.
  - Los ticks de la prórroga cuentan como cobertura, no «tras el cierre».
  - No entra en el veredicto.
  - El techo de SPEC-009 CA-10 sigue ≤ `INFORME_MAX_LINEAS`.

  Tests en `informe.test.ts`, «SPEC-018 CA-6»: (i) 320 `scheduled`, sin cierre → listado; (ii) con `finished` → no, va por SPEC-017 CA-3; (iii) `postponed` → no; (iv) veredicto idéntico con y sin él.
- **CA-7 Los dos partidos de `dev`, reconciliados una vez (H-6).** Ejecución **única y autorizada**, por el camino de SPEC-013 CA-6:
  - Una petición `ids=1572068-1612741`.
  - El crudo se guarda **antes** de parsear.
  - Se insertan las Observations y el motor publica `finished provisional RN-01`.

  Después, `board` da `bergantinos-coruxo` **3-1** y `barco-pontevedra-b` **1-0** (los valores de H-5, `_qa/fuente-sin-directo/h5-2026-10-04T18-56-20.580Z.json`), y `decisions` sube exactamente en dos. La excepción va al ledger con fecha y `raw_ref`; no se convierte en regla.
- **CA-8 Gates y nada de más.**
  - `npm run gates` → 0 y `npm run test:db` en verde.
  - Una migración y ninguna dependencia nueva.
  - Peticiones de la primera jornada tras el despliegue contra SPEC-005 N-4: la prórroga cuesta ≤ 42 peticiones por tanda de rezagados (210 min / 5). El número real va al ledger.

## Entidades y reglas afectadas
- Entidades y términos: Ventana, Cualificador, Decision, Observation, Tick (`dominio.md`).
- Reglas: RN-01, RN-05 y RN-08 (sin cambio de letra), RN-09.
- Decisiones: **ADR-013** (lo que se ejecuta), ADR-002 §2, ADR-008 §2, ADR-009 §3 y ADR-010 §3.
- Specs: SPEC-013 CA-6 (camino de CA-7) y SPEC-017 CA-3 y CA-4.

## Fuera de alcance
- Partidos `live` sin cierre de la fuente: los cierra RN-02 a +120, como hoy.
- `postponed` y `suspended`: son ADR-012 y SPEC-016.
- Corregir el calendario: SPEC-015.
- Segunda fuente u operador: EPIC-004.
- Pintar `sen_sinal`: EPIC-003. Aquí solo existe la etiqueta.

## Notas para el gate humano
- **N-1 Orden y dependencias.** Se implementa **después** de:
  - **SPEC-016** (PR #27, sin fusionar): toca `transitionAllowed` en `engine.ts`.
  - **SPEC-017** (aprobada, con plazo antes del 2026-10-09): la línea de CA-6 va al lado de su CA-3, y su `ventanaEfectiva` (CA-4) es la que se extiende.
  - **SPEC-014** (aprobada): migración en `decisions`, `isInWindow` por `forcedFinish` y `engine.ts`.

  **Decidido por Alberto Fojo, 2026-10-04: orden 016 → 017 → 014 → 018.** La rama de esta spec sale de `main` cuando SPEC-014 esté fusionada.
- **N-2 CA-7 pide una petición nueva** en el momento de ejecutar, y no reutiliza el cuerpo de H-5. Con un `observed_at` del 2026-10-04 el motor lo descartaría por viejo (RN-01, 5 min), y forzar el `now` sería escribir a mano. **Autorizado por Alberto Fojo, 2026-10-04:**
  - Una ejecución única de CA-7 al implementar la spec: una sola petición `ids=` en ese momento.
  - El crudo se guarda antes de parsear, por el camino de SPEC-013 CA-6.
  - `decisions` sube exactamente en 2.
  - Si falla, no hay segunda petición sin una autorización nueva.
- **N-3** El horizonte de +6 h tiene cota (+206 y +236 en los dos tardíos), no una medida exacta (R-ADR-013-2). CA-8 lo vuelve a medir.
