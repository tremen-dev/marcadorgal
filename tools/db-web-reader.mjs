#!/usr/bin/env node
// Sets the secret of web_reader from WEB_READER_PASSWORD on the database of
// DATABASE_URL (SPEC-020 CA-3, ADR-014 §4). Never prints the password nor
// the URL: Postgres only receives its SCRAM verifier.
//
// Usage: npm run db:web-reader
import { createSql } from "../src/db/connect.ts";
import {
  parseWebReaderPassword,
  setWebReaderPassword,
} from "../src/db/web-reader.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: rely on the environment
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

let password;
try {
  password = parseWebReaderPassword(process.env.WEB_READER_PASSWORD);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const sql = createSql(process.env);
try {
  await setWebReaderPassword(sql, password);
  console.log("web_reader: contraseña actualizada");
} catch (e) {
  // The error of a failed connection or ALTER never carries the verifier
  // back, but only the code and a fixed text are printed anyway.
  console.error(`web_reader: no se pudo actualizar (${e?.code ?? "error"})`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
