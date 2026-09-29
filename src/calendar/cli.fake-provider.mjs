// Preload for the calendario:sync tests (SPEC-015 CA-3, CA-4): replaces
// globalThis.fetch with a provider built from the declared calendar of the
// repo, so the tool runs whole without a single request (RN-08).
//
// The fake answers what the repo already says, so a clean run is an empty
// diff. FAKE_PROVIDER_KICKOFFS ({ matchId: kickoff }) moves matches and
// FAKE_PROVIDER_RENAMES ({ externalId: name }) renames teams at the provider.
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

const aliases = readJson("data", "alias", SEASON, "api-football.json");
const externalOfTeam = new Map(aliases.teams.map((t) => [t.teamId, t]));
const externalOfMatch = new Map(
  Object.entries(aliases.matches).map(([ext, id]) => [id, ext]),
);

function response(competitionId) {
  const calendar = readJson(
    "data",
    "calendario",
    SEASON,
    `${competitionId}.json`,
  );
  const team = (teamId) => {
    const alias = externalOfTeam.get(teamId);
    return {
      id: Number(alias.externalId),
      name: renames[alias.externalId] ?? alias.externalName,
    };
  };
  return calendar.matches.map((m) => {
    const id = `${competitionId}-${SEASON}-j${m.round}-${m.home}-${m.away}`;
    return {
      fixture: {
        id: Number(externalOfMatch.get(id)),
        date: kickoffs[id] ?? m.kickoff,
        status: { short: "NS" },
      },
      league: { round: `Regular Season - ${m.round}` },
      teams: { home: team(m.home), away: team(m.away) },
    };
  });
}

globalThis.fetch = async (url) => {
  const league = new URL(url).searchParams.get("league");
  const competitionId = LEAGUES[league];
  if (!competitionId)
    throw new Error(`fake provider: unknown league ${league}`);
  return new Response(
    JSON.stringify({ errors: [], response: response(competitionId) }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
