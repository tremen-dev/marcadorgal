#!/usr/bin/env node
// Applies supabase/migrations to the database in DATABASE_URL (loaded from .env
// when present). Never prints the URL: the Supabase CLI receives it as an
// argument and the child inherits stdio only for its own output.
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const result = spawnSync("supabase", ["db", "push", "--db-url", url, ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
