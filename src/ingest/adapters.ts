import type { Env } from "../db/env.ts";
import type { SourceAdapter, SourceConfig } from "../model/index.ts";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { loadAliasFile } from "./aliases.ts";

// The id -> instance table is the core's, never the registry's (SPEC-005 N-5):
// src/sources/registry.ts stays configuration and imports no adapter.
export type AdapterFactory = (season: string, env: Env) => SourceAdapter;
export type AdapterTable = Readonly<Record<string, AdapterFactory>>;

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const ADAPTERS: AdapterTable = {
  "api-football": (season, env) =>
    createApiFootballResults({
      aliases: loadAliasFile(season, "api-football"),
      apiKey: required(env, "API_FOOTBALL_KEY"),
    }),
};

export function adapterFor(
  config: SourceConfig,
  season: string,
  env: Env,
  table: AdapterTable = ADAPTERS,
): SourceAdapter {
  const factory = table[config.id];
  if (factory === undefined) throw new Error(`no adapter for ${config.id}`);
  const adapter = factory(season, env);
  // A pull source that cannot fetch is a registry mistake, not a runtime one.
  if (config.kind === "pull" && adapter.fetch === undefined)
    throw new Error(`pull source ${config.id} has no fetch`);
  return adapter;
}
