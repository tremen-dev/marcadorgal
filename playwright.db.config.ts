import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { localAnonKey, REMOTE_SECRETS } from "./src/db/env.ts";

// npm run e2e:db (SPEC-020 CA-6, N-4): the home over the local Supabase with a
// seed. Never in CI, never against the remote project (production, ADR-014).
// The URLs are fixed to loopback here and win over any .env. Storage too, and
// the remote secrets go empty: Next does not overwrite an empty variable with
// the .env (SPEC-022 CA-7).
const port = 3110;
export const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const password = randomBytes(24).toString("hex");

// SPEC-024 CA-10: the build of e2e:db has the Realtime switch on, against the
// local Realtime and its key (supabase status), never the .env ones. Without
// a local Supabase the key stays empty and the client says so (polling only).
const status = spawnSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
export const LOCAL_ANON_KEY =
  status.status === 0 ? (localAnonKey(status.stdout ?? "") ?? "") : "";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.db.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalTeardown: "./e2e/db-teardown.ts",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node tools/e2e-db-seed.mjs && npm run build && npm run start -- --port ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: LOCAL_DATABASE_URL,
      WEB_READER_PASSWORD: password,
      DATABASE_URL_PUBLIC: `postgresql://web_reader:${password}@127.0.0.1:54322/postgres`,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ...Object.fromEntries(REMOTE_SECRETS.map((name) => [name, ""])),
      NEXT_PUBLIC_REALTIME: "on",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
    },
  },
});
