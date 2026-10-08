import { describe, expect, it } from "vitest";

// SPEC-022 CA-4: the database suite runs without any remote secret, even when
// the .env carries them. Literal names, not the list in env.ts, so a removal
// there shows here.
describe("SPEC-022 CA-4 no remote secrets inside test:db", () => {
  it.each([
    "API_FOOTBALL_KEY",
    "INGEST_TICK_URL",
    "INGEST_TICK_TOKEN",
    "CRON_SECRET",
    "SUPABASE_ACCESS_TOKEN",
    "DATABASE_PASSWORD",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ])("%s is absent or empty", (name) => {
    expect(process.env[name] ?? "").toBe("");
  });

  it("Storage is the local one", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(
      /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/,
    );
  });
});
