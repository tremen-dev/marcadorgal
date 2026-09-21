import { readFileSync } from "node:fs";
import path from "node:path";
import { AliasFile } from "../model/index.ts";

// The alias file reaches the server as a traced file, not as code and not as
// a table (ADR-008 §8): a new season is a new file. Memoized per season and
// source so a tick every 30 s does not read the disk every 30 s.
const cache = new Map<string, AliasFile>();

export function loadAliasFile(
  season: string,
  sourceId: string,
  dataRoot: string = path.join(process.cwd(), "data"),
): AliasFile {
  const key = `${season}/${sourceId}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const file = path.join(dataRoot, "alias", season, `${sourceId}.json`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    // The path is not in the message: the error travels to ingest_attempts.
    throw new Error(`no alias for ${sourceId} ${season}`);
  }
  const parsed = AliasFile.parse(JSON.parse(text));
  cache.set(key, parsed);
  return parsed;
}
