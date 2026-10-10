#!/usr/bin/env node
// Sets the secret of web_reader from WEB_READER_PASSWORD on the database of
// DATABASE_URL (SPEC-020 CA-3, ADR-014 §4). Never prints the password nor
// the URL: Postgres only receives its SCRAM verifier. Then leaves the role
// clean (SPEC-029): resets every setting of its own (CA-2) and terminates its
// open sessions (CA-3), printing how many.
//
// Usage: npm run db:web-reader
import { createSql } from "../src/db/connect.ts";
import {
  parseWebReaderPassword,
  resetWebReaderSettings,
  setWebReaderPassword,
  terminateWebReaderSessions,
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
  await resetWebReaderSettings(sql);
  console.log("web_reader: ajustes del rol restablecidos");
  const closed = await terminateWebReaderSessions(sql);
  console.log(
    `web_reader: ${closed} ${closed === 1 ? "sesión cerrada" : "sesiones cerradas"}`,
  );
} catch (e) {
  // The error of a failed connection or ALTER never carries the verifier
  // back, but only the code and a fixed text are printed anyway; the one of
  // a setting left behind is ours and carries only its count.
  const left = /^web_reader: quedan \d+ ajustes/.test(e?.message ?? "");
  console.error(
    left
      ? e.message
      : `web_reader: no se pudo actualizar (${e?.code ?? "error"})`,
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
