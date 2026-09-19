#!/usr/bin/env node
// Medición de latencia del directo de API-Football sobre las ligas objetivo.
// Sondea /fixtures?live=<ligas> cada INTERVAL_S segundos y registra cada cambio
// de marcador, minuto o estado con la hora local en que lo vimos. Comparar a
// mano con la hora real del gol (TV, radio, app de la federación).
//
// Uso:  API_FOOTBALL_KEY=... node tools/medir-directo.mjs [intervalo_s] [duracion_min]
// Por defecto: 60 s durante 120 min (~120 peticiones; el plan Free da 100/día,
// así que con Free usa 90 s o menos duración). Salida: tools/medicion-<fecha>.log
import fs from 'node:fs';

const KEY = process.env.API_FOOTBALL_KEY;
if (!KEY) { console.error('Falta API_FOOTBALL_KEY (export o . ./.env)'); process.exit(1); }
const LEAGUES = '140-141-435-875-439';
const INTERVAL_S = Number(process.argv[2] ?? 60);
const DURATION_MIN = Number(process.argv[3] ?? 120);
const log = `tools/medicion-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.log`;
const seen = new Map();
const write = (line) => { console.log(line); fs.appendFileSync(log, line + '\n'); };

write(`# inicio ${new Date().toISOString()} ligas=${LEAGUES} cada ${INTERVAL_S}s durante ${DURATION_MIN}min`);
const end = Date.now() + DURATION_MIN * 60_000;
let requests = 0;
while (Date.now() < end) {
  const t0 = Date.now();
  try {
    const res = await fetch(`https://v3.football.api-sports.io/fixtures?live=${LEAGUES}`, { headers: { 'x-apisports-key': KEY } });
    requests++;
    const body = await res.json();
    const now = new Date().toISOString();
    if (body.errors && Object.keys(body.errors).length) write(`${now} ERROR ${JSON.stringify(body.errors)}`);
    for (const f of body.response ?? []) {
      const key = f.fixture.id;
      const state = `${f.fixture.status.short} ${f.fixture.status.elapsed}' ${f.goals.home}-${f.goals.away}`;
      const prev = seen.get(key);
      if (!prev) write(`${now} NUEVO   [${f.league.name}] ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} (${f.fixture.status.short} ${f.fixture.status.elapsed}')`);
      else if (prev.score !== `${f.goals.home}-${f.goals.away}`) write(`${now} GOL     [${f.league.name}] ${f.teams.home.name} ${f.goals.home}-${f.goals.away} ${f.teams.away.name} min ${f.fixture.status.elapsed} (antes ${prev.score}) ultimo_evento=${JSON.stringify(f.events?.at(-1)?.time ?? null)}`);
      else if (prev.status !== f.fixture.status.short) write(`${now} ESTADO  [${f.league.name}] ${f.teams.home.name}-${f.teams.away.name} ${prev.status} -> ${f.fixture.status.short}`);
      seen.set(key, { score: `${f.goals.home}-${f.goals.away}`, status: f.fixture.status.short, state });
    }
    write(`${now} tick #${requests} en_juego=${body.results} ms=${Date.now() - t0}`);
  } catch (e) { write(`${new Date().toISOString()} EXCEPCION ${e.message}`); }
  await new Promise((r) => setTimeout(r, INTERVAL_S * 1000));
}
write(`# fin ${new Date().toISOString()} peticiones=${requests}`);
