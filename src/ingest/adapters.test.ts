import { describe, expect, it } from "vitest";
import type { ParseResult, SourceAdapter, SourceConfig } from "@/model";
import { SourceId } from "@/model";
import { SOURCES } from "../sources/registry.ts";
import { type AdapterTable, adapterFor } from "./adapters.ts";

const config = SOURCES[0];
const env = { API_FOOTBALL_KEY: "not-a-real-key" };
const empty: ParseResult = { observations: [], unresolved: [], skipped: [] };

describe("CA-5 adapterFor", () => {
  it("builds the api-football adapter with the season alias", () => {
    const adapter = adapterFor(config, "2026-27", env);
    expect(adapter.id).toBe("api-football");
    expect(adapter.kind).toBe("pull");
    expect(typeof adapter.fetch).toBe("function");
  });

  it("resolves a team of the real alias file", () => {
    const adapter = adapterFor(config, "2026-27", env);
    expect(typeof adapter.resolveTeam).toBe("function");
  });

  it("names API_FOOTBALL_KEY when it is not set", () => {
    expect(() => adapterFor(config, "2026-27", {})).toThrow(
      "API_FOOTBALL_KEY is not set",
    );
  });

  it("refuses a source id with no adapter", () => {
    expect(() =>
      adapterFor({ ...config, id: SourceId.parse("other") }, "2026-27", env),
    ).toThrow("no adapter for other");
  });

  it("refuses a pull source whose adapter cannot fetch", () => {
    const stub: SourceAdapter = {
      id: SourceId.parse("push-only"),
      kind: "pull",
      parse: () => empty,
      resolveTeam: () => null,
    };
    const table: AdapterTable = { "push-only": () => stub };
    const pushOnly: SourceConfig = {
      ...config,
      id: SourceId.parse("push-only"),
    };
    expect(() => adapterFor(pushOnly, "2026-27", env, table)).toThrow(
      "pull source push-only has no fetch",
    );
  });

  it("accepts a push source whose adapter cannot fetch", () => {
    const stub: SourceAdapter = {
      id: SourceId.parse("push-only"),
      kind: "push",
      parse: () => empty,
      resolveTeam: () => null,
    };
    const table: AdapterTable = { "push-only": () => stub };
    const push: SourceConfig = {
      ...config,
      id: SourceId.parse("push-only"),
      kind: "push",
    };
    expect(adapterFor(push, "2026-27", env, table)).toBe(stub);
  });
});
