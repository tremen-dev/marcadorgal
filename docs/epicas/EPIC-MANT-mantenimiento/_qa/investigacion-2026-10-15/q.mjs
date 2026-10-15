// read-only query runner: node q.mjs <file.sql> [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "/Users/albertofojo/src/marcadorgal/node_modules/postgres/src/index.js";
process.loadEnvFile("/Users/albertofojo/src/marcadorgal/.env");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false, max: 1, connect_timeout: 10 });
const text = readFileSync(process.argv[2], "utf8");
try {
  const rows = await sql.begin("read only", async (tx) => {
    await tx.unsafe("set local statement_timeout = '30s'");
    return tx.unsafe(text);
  });
  const out = JSON.stringify(rows, null, 1);
  if (process.argv[3]) writeFileSync(process.argv[3], out);
  console.table(rows);
} catch (e) { console.error("ERR", e.message); process.exitCode = 1; }
finally { await sql.end(); }
