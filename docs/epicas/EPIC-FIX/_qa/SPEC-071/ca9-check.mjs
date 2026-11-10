// SPEC-071 CA-7 (a): ca9-check de SPEC-070 adaptado a la ventana (solo
// lectura, sin red). Sobre la salida del dry-run de historico:sync:
// 1) Ningun emparejado cuyos equipos de la fila resuelvan por alias a ids
//    distintos de los del partido (implementacion independiente del codigo).
//    La linea del emparejado puede llevar "fecha → fecha de la fila".
// 2) Los 19 de _qa/SPEC-070/ca9-vecinos.log emparejados, con la fecha de la
//    fila que dice ese log.
import { readFileSync } from "node:fs";
const repo = "D:/src/tremen-dev/marcadorgal";
const log = readFileSync(process.argv[2], "utf8");
const vecinos = readFileSync(`${repo}/docs/epicas/EPIC-FIX/_qa/SPEC-070/ca9-vecinos.log`, "utf8");
const alias = JSON.parse(readFileSync(`${repo}/data/alias/2026-27/rfef.json`, "utf8"));
const norm = (s) => s.normalize("NFC").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
const byName = new Map(alias.teams.map((t) => [norm(t.externalId), t.teamId]));

const { loadDeclaredCalendar } = await import(`file:///${repo}/src/ingest/calendar.ts`);
const cal = new Map(loadDeclaredCalendar("2026-27", `${repo}/data`).map((m) => [m.id, m]));

const lines = log.split(/\r?\n/);
const paired = lines.filter((l) => /^  \d{4}-\d{2}-\d{2}( → \d{4}-\d{2}-\d{2})? · .* · \d+ goles$/.test(l));
let bad = 0, aliasBoth = 0, canonicalSide = 0, noCal = 0, otherDay = 0;
const rowDateOf = new Map();
for (const l of paired) {
  const [dates, matchId, , teams] = l.trim().split(" · ");
  const [, rowDate] = dates.split(" → ");
  if (rowDate) otherDay++;
  rowDateOf.set(matchId, rowDate ?? dates);
  const m = cal.get(matchId);
  if (!m) { noCal++; console.log("SIN CALENDARIO", l); continue; }
  const [h, a] = teams.split("–");
  const rh = byName.get(norm(h)), ra = byName.get(norm(a));
  if ((rh !== undefined && rh !== m.homeTeamId) || (ra !== undefined && ra !== m.awayTeamId)) {
    bad++; console.log("RIVAL DISTINTO", l, rh, ra);
  }
  if (rh !== undefined && ra !== undefined) aliasBoth++; else canonicalSide++;
}
console.log(`emparejados=${paired.length} rival_distinto=${bad} ambos_lados_por_alias=${aliasBoth} algun_lado_por_id_canonico=${canonicalSide} sin_calendario=${noCal} noutro_dia=${otherDay}`);

let ok = 0, ko = 0;
for (const l of vecinos.split(/\r?\n/).filter((x) => x.includes("fila en:"))) {
  const [, matchId, rest] = l.split(" · ");
  const want = rest.replace("fila en: ", "").slice(0, 10);
  const got = rowDateOf.get(matchId);
  if (got === want) ok++;
  else { ko++; console.log("VECINO NO EMPAREJADO", matchId, "quiere", want, "tiene", got ?? "nada"); }
}
console.log(`vecinos_ca9_emparejados=${ok}/${ok + ko}`);
