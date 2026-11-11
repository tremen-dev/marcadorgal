import { describe, expect, it } from "vitest";
import { rfefCalendar } from "../sources/rfef/calendar.ts";
import { IMPORTERS, importerFor } from "./importers.ts";

describe("SPEC-062 CA-2 calendar importers", () => {
  it("registers rfef as the only official importer", () => {
    expect(IMPORTERS).toEqual([rfefCalendar]);
    expect(importerFor("rfef")).toBe(rfefCalendar);
  });

  it("resolves no importer for the retired api-football provider", () => {
    expect(importerFor("api-football")).toBeUndefined();
  });
});
