import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// npm run e2e:db (SPEC-020 CA-6, N-4): the home over the local Supabase with a
// seed. Never in CI, never against the remote project (production, ADR-014).
// The URLs are fixed to loopback here and win over any .env.
const port = 3110;
export const LOCAL_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const password = randomBytes(24).toString("hex");

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
    },
  },
});
