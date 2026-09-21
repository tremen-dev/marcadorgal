import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {
  // no .env: DATABASE_URL must already be in the environment
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
