import { describe, expect, it } from "vitest";
import { sourceConfig } from "../sources/registry.ts";
import { USER_AGENT } from "../sources/rfef/adapter.ts";

// SPEC-032 CA-2, ADR-021 §6: the calibration and the adapter send the UA of
// the registry, the declared identity. The rfef is not registered, so the
// comparison is with the entry that already declares it.
describe("SPEC-032 CA-2 the declared identity", () => {
  it("USER_AGENT of adapter.ts is the UA of the registry", () => {
    expect(USER_AGENT).toBe(sourceConfig("api-football")?.userAgent);
    expect(sourceConfig("rfef")).toBeUndefined();
  });
});
