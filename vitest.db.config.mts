import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { isLoopbackUrl, REMOTE_SECRETS } from "./src/db/env.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: DATABASE_URL must already be in the environment
}

// The remote project is production (ADR-014 §1): the database tests write, so
// they only ever run against the local Supabase (SPEC-020 CA-1).
if (!isLoopbackUrl(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    "vitest.db.config.mts: DATABASE_URL is not loopback; use npm run test:db against supabase start",
  );
}

// Storage too (SPEC-022 CA-3): tools/test-db.mjs forces the local one; this is
// the last defence when vitest is launched by hand over the production .env.
if (!isLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
  throw new Error(
    "vitest.db.config.mts: NEXT_PUBLIC_SUPABASE_URL is not loopback; use npm run test:db against supabase start",
  );
}

// The suite needs no remote secret (SPEC-022 CA-4).
for (const name of REMOTE_SECRETS) process.env[name] = "";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tools/empty-module.mjs", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    fileParallelism: false,
    setupFiles: ["./src/db/fetch-guard.setup.ts"],
  },
});
