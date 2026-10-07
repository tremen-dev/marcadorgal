import { describe, expect, it } from "vitest";
import { databaseUrl, isLoopbackUrl } from "./env";

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

describe("SPEC-020 CA-1 isLoopbackUrl", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://u:p@localhost:5432/db",
    "postgresql://u:p@127.0.0.2/db",
    "postgresql://u:p@[::1]:54322/postgres",
  ])("accepts %s", (url) => {
    expect(isLoopbackUrl(url)).toBe(true);
  });

  it.each([
    "postgresql://postgres.abc:pw@aws-0-eu-west-3.pooler.supabase.com:6543/postgres",
    "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres",
    "postgresql://u:p@localhost.example.com/db",
    "postgresql://u:p@10.0.0.1/db",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(isLoopbackUrl(url)).toBe(false);
  });
});
