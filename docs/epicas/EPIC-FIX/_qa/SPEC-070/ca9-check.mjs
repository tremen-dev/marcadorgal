// SPEC-070 CA-9: comprobaciones sobre la salida del dry-run (solo lectura).
// 1) Ningun emparejado cuyos equipos de la fila resuelvan por alias a ids
//    distintos de los del partido (implementacion independiente del codigo).
// 2) Causa de cada sin emparejar: filas del export de ese dia (GET de solo
//    lectura a explorer) en su competicion y con alguno de sus equipos.
import { readFileSync } from "node:fs";
const repo = "D:/src/tremen-dev/marcadorgal";
const log = readFileSync(process.argv[2], "utf8");
const alias = JSON.parse(readFileSync(`${repo}/data/alias/2026-27/rfef.json`, "utf8"));
const norm = (s) => s.normalize("NFC").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
const byName = new Map(alias.teams.map((t) => [norm(t.externalId), t.teamId]));
const groupOf = alias.competitions;

const { loadDeclaredCalendar } = await import(`file:///${repo}/src/ingest/calendar.ts`);
const cal = new Map(loadDeclaredCalendar("2026-27", `${repo}/data`).map((m) => [m.id, m]));

const lines = log.split(/\r?\n/);
const paired = lines.filter((l) => /^  \d{4}-\d{2}-\d{2} · .* · \d+ goles$/.test(l));
let bad = 0, aliasBoth = 0, canonicalSide = 0, noCal = 0;
for (const l of paired) {
  const [, matchId, , teams] = l.trim().split(" · ");
  const m = cal.get(matchId);
  if (!m) { noCal++; console.log("SIN CALENDARIO", l); continue; }
  const [h, a] = teams.split("–");
  const rh = byName.get(norm(h)), ra = byName.get(norm(a));
  if ((rh !== undefined && rh !== m.homeTeamId) || (ra !== undefined && ra !== m.awayTeamId)) {
    bad++; console.log("RIVAL DISTINTO", l, rh, ra);
  }
  if (rh !== undefined && ra !== undefined) aliasBoth++; else canonicalSide++;
}
console.log(`emparejados=${paired.length} rival_distinto=${bad} ambos_lados_por_alias=${aliasBoth} algun_lado_por_id_canonico=${canonicalSide} sin_calendario=${noCal}`);

if (process.argv[3] === "--causas") {
  const token = process.env.RFEF_EXPLORER_TOKEN;
  const un = lines.filter((l) => / · (no_identity|no_competition_rows)$/.test(l)).map((l) => l.trim().split(" · "));
  const cache = new Map();
  for (const [date, matchId, reason] of un) {
    if (!cache.has(date)) {
      const r = await fetch(`https://marcadorgal-explorer.vercel.app/api/export/matches?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
      cache.set(date, (await r.json()).matches);
    }
    const m = cal.get(matchId);
    const rows = cache.get(date).filter((r) => {
      const comp = groupOf[r.codGrupo] ?? r.canonicalCompetitionId;
      if (comp !== m.competitionId) return false;
      const ids = [byName.get(norm(r.equipoLocal)), byName.get(norm(r.equipoVisitante)), r.canonicalHomeTeamId, r.canonicalAwayTeamId];
      return ids.includes(m.homeTeamId) || ids.includes(m.awayTeamId);
    });
    console.log(`\n${date} · ${matchId} · ${reason} · kickoff ${m.kickoff}`);
    if (rows.length === 0) console.log("   (ninguna fila de su competicion con alguno de sus equipos ese dia)");
    for (const r of rows) console.log(`   fila ${r.codActa ?? "sen acta"} ${r.horaTexto} ${r.estado} "${r.equipoLocal}"->${byName.get(norm(r.equipoLocal)) ?? "∅"}/${r.canonicalHomeTeamId ?? "∅"} – "${r.equipoVisitante}"->${byName.get(norm(r.equipoVisitante)) ?? "∅"}/${r.canonicalAwayTeamId ?? "∅"} ${r.golesLocal}-${r.golesVisitante}`);
  }
}
