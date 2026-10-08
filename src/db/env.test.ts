import { describe, expect, it } from "vitest";
import {
  databaseUrl,
  isLoopbackUrl,
  localAnonKey,
  localStorageEnv,
  parseStatusEnv,
  REMOTE_SECRETS,
  withoutRemoteSecrets,
} from "./env";

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
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable",
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
    // V-3: libpq and pgx honour host/hostaddr in the query over the authority.
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.invalid",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres?hostaddr=10.0.0.1",
    "postgresql://postgres:postgres@localhost:54322/postgres?sslmode=disable&host=db.invalid",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres?HOST=db.invalid",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres?%68ost=db.invalid",
  ])("rejects %s", (url) => {
    expect(isLoopbackUrl(url)).toBe(false);
  });
});

describe("SPEC-022 local Storage env from supabase status", () => {
  const status = [
    'ANON_KEY="anon-local"',
    'API_URL="http://127.0.0.1:54321"',
    'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
    'SERVICE_ROLE_KEY="service-local"',
    "",
  ].join("\n");

  it('parses KEY="value" lines and ignores the rest', () => {
    expect(
      parseStatusEnv(`${status}A new version of Supabase CLI is available\n`),
    ).toEqual({
      ANON_KEY: "anon-local",
      API_URL: "http://127.0.0.1:54321",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      SERVICE_ROLE_KEY: "service-local",
    });
  });

  it("maps API_URL and SERVICE_ROLE_KEY to the app's names (CA-1)", () => {
    expect(localStorageEnv(status)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "service-local",
    });
  });

  it.each([
    [
      "a remote API_URL",
      status.replace("http://127.0.0.1:54321", "https://x.supabase.co"),
    ],
    ["no API_URL", status.replace(/API_URL=.*\n/, "")],
    ["no SERVICE_ROLE_KEY", status.replace(/SERVICE_ROLE_KEY=.*\n/, "")],
    ["empty output", ""],
  ])("is null with %s (CA-2)", (_, text) => {
    expect(localStorageEnv(text)).toBeNull();
  });

  // SPEC-024 CA-10: the Realtime of e2e:db is the local one, with its key.
  it("localAnonKey: the ANON_KEY of a loopback API_URL", () => {
    expect(localAnonKey(status)).toBe("anon-local");
  });

  it.each([
    [
      "a remote API_URL",
      status.replace("http://127.0.0.1:54321", "https://x.supabase.co"),
    ],
    ["no API_URL", status.replace(/API_URL=.*\n/, "")],
    ["no ANON_KEY", status.replace(/ANON_KEY=.*\n/, "")],
    ["empty output", ""],
  ])("localAnonKey is null with %s", (_, text) => {
    expect(localAnonKey(text)).toBeNull();
  });

  it("blanks every remote secret and keeps the rest (CA-4)", () => {
    const env = Object.fromEntries(REMOTE_SECRETS.map((k) => [k, "prod"]));
    const out = withoutRemoteSecrets({ ...env, PATH: "/bin" });
    expect(out.PATH).toBe("/bin");
    for (const k of REMOTE_SECRETS) expect(out[k]).toBe("");
    expect([...REMOTE_SECRETS].sort()).toEqual(
      [
        "API_FOOTBALL_KEY",
        "CRON_SECRET",
        "DATABASE_PASSWORD",
        "INGEST_TICK_TOKEN",
        "INGEST_TICK_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_ACCESS_TOKEN",
      ].sort(),
    );
  });
});
