import postgres from "postgres";
import { databaseUrl, type Env } from "./env.ts";

// prepare: false keeps the client usable behind the transaction pooler
// (SPEC-002 N-6). No "server-only" here so Node scripts can import it.
export function createSql(env: Env) {
  return postgres(databaseUrl(env), { ssl: "require", prepare: false });
}
