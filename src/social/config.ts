import { GALICIAN_SEASONS } from "../calendar/galicians.ts";
import { GalicianTeamsFile } from "../model/index.ts";
import { PUBLISHER_IDS } from "./publisher.ts";

// SPEC-066 CA-10 (ADR-030 §7): the configuration of the account, read from
// the environment of Vercel by a pure and tolerant parser. Changing a
// variable is a redeploy of the same commit, never a PR (SPEC-042). Anything
// that does not parse is the default, and the default is off: dry mode.

export type SocialConfig = {
  // The id of the publisher of PUBLISHERS, or null: off (dry mode).
  publisher: string | null;
  // The TeamIds to publish, or null: those of data/galegos/<season>.json.
  watchedTeams: ReadonlySet<string> | null;
  // The last line of every text, or null: no link.
  linkUrl: string | null;
};

type Env = Readonly<Record<string, string | undefined>>;

const SITE = "https://marcador.gal";

export function socialConfig(
  env: Env,
  known: readonly string[] = PUBLISHER_IDS,
): SocialConfig {
  return {
    publisher: parsePublisher(env.SOCIAL_PUBLISHER, known),
    watchedTeams: parseWatched(env.SOCIAL_WATCHED_TEAMS),
    linkUrl: parseLink(env.SOCIAL_LINK_URL),
  };
}

// SOCIAL_PUBLISHER is only worth something when it names a publisher of the
// registry; anything else, or nothing, is off.
function parsePublisher(
  value: string | undefined,
  known: readonly string[],
): string | null {
  const wanted = value?.trim() ?? "";
  return known.includes(wanted) ? wanted : null;
}

// SOCIAL_WATCHED_TEAMS: ids separated by commas, trimmed; empty is the
// default of the season.
function parseWatched(value: string | undefined): ReadonlySet<string> | null {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return ids.length === 0 ? null : new Set(ids);
}

// SOCIAL_LINK_URL: https://marcador.gal or a path of it, nothing else. A
// query, another host or http never go out in a tweet.
function parseLink(value: string | undefined): string | null {
  const wanted = value?.trim() ?? "";
  if (wanted === "") return null;
  let url: URL;
  try {
    url = new URL(wanted);
  } catch {
    return null;
  }
  if (url.origin !== SITE || url.search !== "" || url.hash !== "") return null;
  return wanted === SITE || wanted.startsWith(`${SITE}/`) ? wanted : null;
}

// The teams watched for a match of `season`: the list of the variable, or the
// Equipo galego of the season (data/galegos/<season>.json, SPEC-033). A
// season without a file watches nobody.
export function watchedTeams(
  config: SocialConfig,
  season: string,
): ReadonlySet<string> {
  if (config.watchedTeams !== null) return config.watchedTeams;
  const declared = GALICIAN_SEASONS[season];
  if (declared === undefined) return new Set();
  return new Set(GalicianTeamsFile.parse(declared.ids));
}
