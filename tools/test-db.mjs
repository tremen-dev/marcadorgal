#!/usr/bin/env node
// npm run test:db (SPEC-020 CA-1, ADR-014 §1): applies the migrations and runs
// the database tests, only against the local Supabase. The remote project is
// production: a DATABASE_URL whose host is not loopback is refused before the
// CLI or vitest are even started. Never prints the URL.
//
// Usage: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
import { spawnSync } from "node:child_process";
import { isLoopbackUrl } from "../src/db/env.ts";

try {
  // Does not override what is already in the environment.
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (!isLoopbackUrl(url)) {
  console.error(
    "test:db only runs against the local Supabase: the host of DATABASE_URL is not loopback, or its query names host or hostaddr.\n" +
      "Run: supabase start, then DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db",
  );
  process.exit(1);
}

const step = (command, args) => {
  const r = spawnSync(command, args, { stdio: "inherit" });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
};

step("supabase", ["db", "push", "--db-url", url, ...process.argv.slice(2)]);
step("npx", ["vitest", "run", "--config", "vitest.db.config.mts"]);
