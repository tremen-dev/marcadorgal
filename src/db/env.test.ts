import { describe, expect, it } from "vitest";
import { databaseUrl } from "./env";

describe("CA-13 databaseUrl", () => {
  it("returns DATABASE_URL from the given environment", () => {
    expect(databaseUrl({ DATABASE_URL: "postgresql://u:p@h:5432/db" })).toBe(
      "postgresql://u:p@h:5432/db",
    );
  });

  it("throws when DATABASE_URL is missing or empty", () => {
    expect(() => databaseUrl({})).toThrow("DATABASE_URL is not set");
    expect(() => databaseUrl({ DATABASE_URL: "" })).toThrow(
      "DATABASE_URL is not set",
    );
  });
});
