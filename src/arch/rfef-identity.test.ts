import { describe, expect, it } from "vitest";
import { sourceConfig } from "../sources/registry.ts";
import { USER_AGENT } from "../sources/rfef/adapter.ts";

// SPEC-032 CA-2, ADR-021 §6: the calibration and the adapter send the UA of
// the registry, the declared identity. Since SPEC-038 CA-7 the rfef is
// registered (via explorer, ADR-023), so the entry itself has to declare it,
// and it is the same UA api-football declares (F-SPEC-032-4).
describe("SPEC-032 CA-2 the declared identity", () => {
  it("USER_AGENT of adapter.ts is the UA of the rfef entry of the registry", () => {
    expect(sourceConfig("rfef")).toBeDefined();
    expect(sourceConfig("rfef")?.userAgent).toBe(USER_AGENT);
  });
});
