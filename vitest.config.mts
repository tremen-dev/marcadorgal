import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // server-only throws outside React Server Components; the db client
      // keeps the guard for next build and the test stubs it (F-SPEC-006-7).
      "server-only": fileURLToPath(
        new URL("./tools/empty-module.mjs", import.meta.url),
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.db.test.ts"],
  },
});
