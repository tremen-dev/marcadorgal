import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  // e2e:db needs the local Supabase (playwright.db.config.ts, SPEC-020 N-4).
  testIgnore: "**/*.db.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: `http://localhost:${port}/`,
    reuseExistingServer: false,
    // No reader in CI (SPEC-020 CA-6): an empty value wins over any .env.
    // SPEC-024 CA-10: the switch off, whatever the .env says.
    env: { DATABASE_URL_PUBLIC: "", NEXT_PUBLIC_REALTIME: "" },
    timeout: 180_000,
  },
});
