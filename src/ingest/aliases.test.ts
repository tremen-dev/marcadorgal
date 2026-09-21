import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { AliasFile } from "@/model";
import { loadAliasFile } from "./aliases.ts";

const root = path.join(tmpdir(), `marcadorgal-alias-${crypto.randomUUID()}`);

const write = (season: string, sourceId: string, data: unknown): string => {
  const dir = path.join(root, "alias", season);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sourceId}.json`);
  writeFileSync(file, JSON.stringify(data), "utf8");
  return file;
};

const valid = (season: string) => ({
  source: "api-football",
  season,
  teams: [{ externalId: "530", externalName: "Celta", teamId: "celta" }],
  matches: { "1": "primera-division-2026-27-j1-celta-deportivo" },
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("CA-4 loadAliasFile", () => {
  it("reads and validates data/alias/<season>/<source>.json", () => {
    write("2030-31", "api-football", valid("2030-31"));
    expect(loadAliasFile("2030-31", "api-football", root)).toEqual(
      AliasFile.parse(valid("2030-31")),
    );
  });

  it("throws with the zod issues when the file is invalid", () => {
    write("2031-32", "api-football", { source: "api-football", teams: "no" });
    let issues: { path: PropertyKey[] }[] = [];
    try {
      loadAliasFile("2031-32", "api-football", root);
      expect.unreachable("an invalid alias file must throw");
    } catch (e) {
      issues = (e as { issues?: { path: PropertyKey[] }[] }).issues ?? [];
    }
    expect(issues.map((i) => i.path)).toContainEqual(["teams"]);
  });

  it("names the source and the season when the file is missing", () => {
    expect(() => loadAliasFile("2032-33", "api-football", root)).toThrow(
      "no alias for api-football 2032-33",
    );
  });

  it("memoizes by season and source: it never reads the file twice", () => {
    const file = write("2033-34", "api-football", valid("2033-34"));
    const first = loadAliasFile("2033-34", "api-football", root);
    rmSync(file);
    const second = loadAliasFile("2033-34", "api-football", root);
    expect(second).toBe(first);
  });

  it("reads the real alias of the season from data/", () => {
    const aliases = loadAliasFile("2026-27", "api-football");
    expect(aliases.source).toBe("api-football");
    expect(aliases.teams.length).toBeGreaterThan(0);
  });
});
