import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import galegos from "../../data/galegos/2026-27.json";
import { socialConfig, watchedTeams } from "./config.ts";

// SPEC-066 CA-10 (ADR-030 §7): the pure, tolerant parser of the three
// variables. Nothing here reads process.env.

describe("SPEC-066 CA-10 socialConfig: SOCIAL_PUBLISHER", () => {
  it.each([
    ["absent", {}, null],
    ["empty", { SOCIAL_PUBLISHER: "" }, null],
    ["unknown id", { SOCIAL_PUBLISHER: "twitter" }, null],
    ["a known id, trimmed", { SOCIAL_PUBLISHER: " buffer " }, "buffer"],
    ["case matters", { SOCIAL_PUBLISHER: "Buffer" }, null],
  ])("%s", (_, env, publisher) => {
    expect(socialConfig(env, ["buffer"]).publisher).toBe(publisher);
  });

  it("with the registry of this spec (empty) every value is off", () => {
    expect(socialConfig({ SOCIAL_PUBLISHER: "buffer" }).publisher).toBeNull();
    expect(socialConfig({ SOCIAL_PUBLISHER: "memory" }).publisher).toBeNull();
  });
});

describe("SPEC-066 CA-10 socialConfig: SOCIAL_WATCHED_TEAMS", () => {
  it.each([
    ["absent", {}, null],
    ["empty", { SOCIAL_WATCHED_TEAMS: "" }, null],
    ["only commas and spaces", { SOCIAL_WATCHED_TEAMS: " , , " }, null],
    [
      "ids separated by commas, trimmed, empties dropped",
      { SOCIAL_WATCHED_TEAMS: " celta, deportivo ,,lugo " },
      ["celta", "deportivo", "lugo"],
    ],
    ["one id", { SOCIAL_WATCHED_TEAMS: "celta" }, ["celta"]],
  ])("%s", (_, env, ids) => {
    const watched = socialConfig(env).watchedTeams;
    expect(watched === null ? null : [...watched]).toEqual(ids);
  });

  it("watchedTeams resolves the default to data/galegos/<season>.json", () => {
    const config = socialConfig({});
    expect([...watchedTeams(config, "2026-27")].sort()).toEqual(
      [...galegos].sort(),
    );
    expect(watchedTeams(config, "2026-27").has("celta")).toBe(true);
    expect(watchedTeams(config, "2026-27").has("real-madrid")).toBe(false);
    // A season without a file watches nobody.
    expect(watchedTeams(config, "1999-00").size).toBe(0);
  });

  it("watchedTeams with a list ignores the season", () => {
    const config = socialConfig({ SOCIAL_WATCHED_TEAMS: "real-madrid" });
    expect([...watchedTeams(config, "2026-27")]).toEqual(["real-madrid"]);
    expect([...watchedTeams(config, "1999-00")]).toEqual(["real-madrid"]);
  });
});

describe("SPEC-066 CA-10 socialConfig: SOCIAL_LINK_URL", () => {
  it.each([
    ["absent", {}, null],
    ["empty", { SOCIAL_LINK_URL: "" }, null],
    [
      "the site",
      { SOCIAL_LINK_URL: "https://marcador.gal" },
      "https://marcador.gal",
    ],
    [
      "a path of the site",
      { SOCIAL_LINK_URL: "https://marcador.gal/xornada" },
      "https://marcador.gal/xornada",
    ],
    [
      "trimmed",
      { SOCIAL_LINK_URL: " https://marcador.gal/ " },
      "https://marcador.gal/",
    ],
    ["http", { SOCIAL_LINK_URL: "http://marcador.gal" }, null],
    [
      "another host",
      { SOCIAL_LINK_URL: "https://marcador.gal.evil.com/x" },
      null,
    ],
    ["a subdomain", { SOCIAL_LINK_URL: "https://www.marcador.gal" }, null],
    ["a query", { SOCIAL_LINK_URL: "https://marcador.gal/?utm=x" }, null],
    ["not a url", { SOCIAL_LINK_URL: "marcador.gal" }, null],
  ])("%s", (_, env, link) => {
    expect(socialConfig(env).linkUrl).toBe(link);
  });
});

describe("SPEC-066 CA-10 .env.example", () => {
  it("documents the three variables", () => {
    const example = readFileSync(
      path.resolve(__dirname, "../../.env.example"),
      "utf8",
    );
    for (const name of [
      "SOCIAL_PUBLISHER",
      "SOCIAL_WATCHED_TEAMS",
      "SOCIAL_LINK_URL",
    ])
      expect(example).toMatch(new RegExp(`^${name}=`, "m"));
  });
});
