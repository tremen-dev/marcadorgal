import { defineConfig, devices } from "@playwright/test";

const port = 3100;
// SPEC-041 CA-6, SPEC-042 CA-3: the alternative variant («box») of the
// recent goal; the default one («label») is served on port.
export const boxPort = 3101;

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
  // SPEC-041 CA-6, SPEC-042 CA-3: the same build served twice, the first
  // with the default variant (RECENT_GOAL_MARK empty, whatever the .env
  // says) and the second with the alternative, «box» (config.ts
  // recentGoalMark). Started in order, so the second starts once the build
  // of the first is done.
  webServer: [
    {
      command: `npm run build && npm run start -- --port ${port}`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: false,
      // No reader in CI (SPEC-020 CA-6): an empty value wins over any .env.
      // SPEC-024 CA-10: the switch off, whatever the .env says.
      env: {
        DATABASE_URL_PUBLIC: "",
        NEXT_PUBLIC_REALTIME: "",
        RECENT_GOAL_MARK: "",
        SHOW_DAY_STRIP: "true",
      },
      timeout: 180_000,
    },
    {
      command: `npm run start -- --port ${boxPort}`,
      url: `http://localhost:${boxPort}/`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL_PUBLIC: "",
        NEXT_PUBLIC_REALTIME: "",
        RECENT_GOAL_MARK: "box",
      },
      timeout: 60_000,
    },
  ],
});
