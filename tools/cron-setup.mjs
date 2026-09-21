#!/usr/bin/env node
// Puts the two secrets the pg_cron job reads into Supabase Vault (SPEC-008
// CA-3, H-4): the migration names them, this script gives them a value from
// .env. It prints names, never values.
//
// Usage: npm run cron:setup
import { createSql } from "../src/db/connect.ts";
import { setupCronSecrets } from "../src/ingest/cron.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

const message = (e) => (e instanceof Error ? e.message : String(e));

for (const variable of ["INGEST_TICK_URL", "INGEST_TICK_TOKEN"]) {
  if (!process.env[variable]) {
    console.error(`${variable} is not set`);
    process.exit(1);
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = createSql(process.env);
try {
  for (const line of await setupCronSecrets(sql, process.env)) console.log(line);
} catch (e) {
  console.error(message(e));
  process.exitCode = 1;
} finally {
  await sql.end();
}
