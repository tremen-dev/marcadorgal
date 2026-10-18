# Handshake de sesión RFEF (orquestador, 2026-10-12)

La serie de calibración del 2026-10-12T19:16:48Z paró en la vuelta 1: `GET /pnfg/` → 302,
`POST todos` → 302 a NLogin (ver `2026-10-12.jsonl`). No es el bloqueo (que da 200 + 0 B).

Diagnóstico con curl y cookie jar, UA del registro:

```
19:17Z GET /pnfg/ (sin cookie)        → 302, Set-Cookie: JSESSIONID=…; Path=/pnfg; Secure; HttpOnly, Location: /pnfg/NLogin
19:17Z GET /pnfg/NLogin?NSess=1 (cookie) → 302, Location: https://marcadores.rfef.es/pnfg/
19:17Z GET /pnfg/ (cookie)            → 200, 44617 B
19:18Z GET /pnfg/ → GET /pnfg/NLogin (302) → POST NFG_CMP_Paneles Sch_en_juego=1 → 200, 18771 B
```

Conclusión: la sesión solo queda activa tras visitar `/pnfg/NLogin` con la cookie recién
emitida. El adaptador (SPEC-031) y la calibración (SPEC-032) se saltan ese paso. Peticiones
a la RFEF desde esta IP el 2026-10-12: 2 (serie) + 6 (diagnóstico), 19:16–19:18Z. Cabecera
`Date` del servidor ~124 s por delante del reloj local, como el 2026-10-10.
