import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config, { LOCAL_ANON_KEY } from "../../playwright.db.config.ts";

// SPEC-022 CA-7: e2e:db starts the app on the local Storage and without any
// remote secret, whatever the .env says.
describe("SPEC-022 CA-7 playwright.db.config.ts webServer.env", () => {
  const server = Array.isArray(config.webServer)
    ? config.webServer[0]
    : config.webServer;
  const env = server?.env ?? {};

  it("fixes Storage to the local Supabase", () => {
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it.each([
    "SUPABASE_SERVICE_ROLE_KEY",
    "API_FOOTBALL_KEY",
    "INGEST_TICK_URL",
    "INGEST_TICK_TOKEN",
    "CRON_SECRET",
    "SUPABASE_ACCESS_TOKEN",
    "DATABASE_PASSWORD",
  ])("leaves %s empty", (name) => {
    expect(env[name]).toBe("");
  });

  // SPEC-024 CA-10 (amends the line above for the anon key): Realtime on,
  // with the key of the local Supabase (supabase status) or none, never the
  // one of the .env.
  it("turns Realtime on against the local Supabase", () => {
    expect(env.NEXT_PUBLIC_REALTIME).toBe("on");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(LOCAL_ANON_KEY);
    const dotenv = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m.exec(
      existsSync(".env") ? readFileSync(".env", "utf8") : "",
    )?.[1];
    if (dotenv) expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).not.toBe(dotenv);
  });
});
