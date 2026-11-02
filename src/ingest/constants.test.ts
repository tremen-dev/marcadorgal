import { describe, expect, it } from "vitest";
import { SOURCES } from "../sources/registry.ts";
import { RECOVERY_HORIZON_HOURS, RECOVERY_POLL_MINUTES } from "./constants.ts";

// SPEC-044 CA-2 (ADR-025 §1, §5): the recovery horizon lives here, per
// source, while it is not in the registry (H-5). Every key has to be a
// source of the registry: a horizon for a source nobody registered is a typo
// that would poll nothing and tell nobody.
describe("SPEC-044 CA-2 the recovery horizon per source", () => {
  it("names only sources of the registry", () => {
    const ids = new Set(SOURCES.map((s) => s.id as string));
    for (const key of Object.keys(RECOVERY_HORIZON_HOURS))
      expect(ids.has(key), `${key} is not a registered source`).toBe(true);
  });

  it("gives the rfef 72 hours and api-football none (H-1, ADR-025 §1)", () => {
    expect(RECOVERY_HORIZON_HOURS.rfef).toBe(72);
    expect(RECOVERY_HORIZON_HOURS["api-football"] ?? 0).toBe(0);
  });

  it("paces an attempt with recovery every 5 minutes (H-8)", () => {
    expect(RECOVERY_POLL_MINUTES).toBe(5);
  });
});
