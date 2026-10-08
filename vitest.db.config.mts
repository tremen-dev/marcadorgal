import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { isLoopbackUrl } from "./src/db/env.ts";

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
  },
});
