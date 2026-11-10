// SPEC-070 CA-9: para cada sin emparejar, busca su fila (identidad completa)
// en el export de los dias vecinos (-3..+3). GET de solo lectura a explorer.
import { readFileSync } from "node:fs";
const repo = "D:/src/tremen-dev/marcadorgal";
const log = readFileSync(process.argv[2], "utf8");
const alias = JSON.parse(readFileSync(`${repo}/data/alias/2026-27/rfef.json`, "utf8"));
const norm = (s) => s.normalize("NFC").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
const byName = new Map(alias.teams.map((t) => [norm(t.externalId), t.teamId]));
const { loadDeclaredCalendar } = await import(`file:///${repo}/src/ingest/calendar.ts`);
const cal = new Map(loadDeclaredCalendar("2026-27", `${repo}/data`).map((m) => [m.id, m]));
const token = process.env.RFEF_EXPLORER_TOKEN;
const cache = new Map();
const day = async (d) => {
  if (!cache.has(d)) {
    const r = await fetch(`https://marcadorgal-explorer.vercel.app/api/export/matches?date=${d}`, { headers: { Authorization: `Bearer ${token}` } });
    cache.set(d, r.ok ? (await r.json()).matches : []);
  }
  return cache.get(d);
};
const shift = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const un = log.split(/\r?\n/).filter((l) => / · (no_identity|no_competition_rows)$/.test(l)).map((l) => l.trim().split(" · "));
for (const [date, matchId] of un) {
  const m = cal.get(matchId);
  const found = [];
  for (let n = -3; n <= 3; n++) {
    const d = shift(date, n);
    for (const r of await day(d)) {
      const comp = alias.competitions[r.codGrupo] ?? r.canonicalCompetitionId;
      const h = byName.get(norm(r.equipoLocal)) ?? r.canonicalHomeTeamId;
      const a = byName.get(norm(r.equipoVisitante)) ?? r.canonicalAwayTeamId;
      if (comp === m.competitionId && h === m.homeTeamId && a === m.awayTeamId)
        found.push(`${d} ${r.horaTexto} ${r.estado} ${r.codActa ?? "sen acta"} ${r.golesLocal}-${r.golesVisitante}`);
    }
  }
  console.log(`${date} · ${matchId} · ${found.length ? "fila en: " + found.join(" | ") : "sin fila en ±3 dias"}`);
}
