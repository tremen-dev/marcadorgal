// Preload for the calendario:sync tests (SPEC-015 CA-3, CA-4): replaces
// globalThis.fetch with a provider built from the declared calendar of the
// repo, so the tool runs whole without a single request (RN-08).
//
// The fake answers what the repo already says, so a clean run is an empty
// diff. FAKE_PROVIDER_KICKOFFS ({ matchId: kickoff }) moves matches and
// FAKE_PROVIDER_RENAMES ({ externalId: name }) renames teams at the provider.
// FAKE_EXPORT_MATCHES gives the export of matches by day (SPEC-071).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const SEASON = "2026-27";
const LEAGUES = {
  140: "primera-division",
  141: "segunda-division",
  435: "primera-rfef-g1",
  875: "segunda-rfef-g1",
  439: "tercera-rfef-g1",
};
const readJson = (...parts) =>
  JSON.parse(readFileSync(path.join(root, ...parts), "utf8"));
const kickoffs = JSON.parse(process.env.FAKE_PROVIDER_KICKOFFS ?? "{}");
const renames = JSON.parse(process.env.FAKE_PROVIDER_RENAMES ?? "{}");

const rfefAliases = readJson("data", "alias", SEASON, "rfef.json");
const teamToAlias = new Map();
for (const t of rfefAliases.teams) {
  if (!teamToAlias.has(t.teamId)) {
    teamToAlias.set(t.teamId, t);
  }
}

function explorerResponse(competitionId) {
  const calendar = readJson(
    "data",
    "calendario",
    SEASON,
    `${competitionId}.json`,
  );
  const team = (teamId) => {
    const alias = teamToAlias.get(teamId);
    const rawRename =
      renames[alias.externalId] ??
      (alias.teamId === "barcelona" ? renames["529"] : undefined);
    const rename =
      rawRename === alias.externalName ? `${rawRename} Modificado` : rawRename;
    return {
      externalId: String(alias.externalId),
      externalName: rename ?? alias.externalName,
    };
  };
  const teamsMap = new Map();
  const matches = calendar.matches.map((m) => {
    const id = `${competitionId}-${SEASON}-j${m.round}-${m.home}-${m.away}`;
    const homeTeam = team(m.home);
    const awayTeam = team(m.away);
    teamsMap.set(homeTeam.externalId, homeTeam);
    teamsMap.set(awayTeam.externalId, awayTeam);
    return {
      externalId: id,
      round: m.round,
      kickoff: kickoffs[id] ?? m.kickoff,
      home: homeTeam.externalId,
      away: awayTeam.externalId,
      timeConfirmed: true,
    };
  });
  return {
    competition: competitionId,
    season: SEASON,
    exportedAt: new Date().toISOString(),
    teams: [...teamsMap.values()],
    matches,
    ignoredRounds: {},
  };
}

// The export of matches of explorer (SPEC-071): FAKE_EXPORT_MATCHES
// ({ "YYYY-MM-DD": rows }) answers ?date=, every other day is empty.
const exportMatches = JSON.parse(process.env.FAKE_EXPORT_MATCHES ?? "{}");

globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  if (parsed.pathname === "/api/export/matches") {
    const date = parsed.searchParams.get("date");
    return new Response(
      JSON.stringify({
        date,
        exportedAt: new Date().toISOString(),
        matches: exportMatches[date] ?? [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  const comp = parsed.searchParams.get("competition");
  const league = parsed.searchParams.get("league");
  const competitionId = comp || LEAGUES[league];
  if (!competitionId)
    throw new Error(`fake provider: unknown league or competition in ${url}`);

  if (comp) {
    return new Response(JSON.stringify(explorerResponse(competitionId)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({ errors: [], response: response(competitionId) }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
