import postgres from "postgres";
import { databaseUrl, type Env, isLoopbackUrl } from "./env.ts";

// prepare: false keeps the client usable behind the transaction pooler
// (SPEC-002 N-6). TLS always, except on loopback: the local Supabase in
// Docker does not speak it (SPEC-020 CA-1). No "server-only" here so Node
// scripts can import it.
export function sqlOptionsFor(url: string) {
  return {
    ssl: isLoopbackUrl(url) ? (false as const) : ("require" as const),
    prepare: false,
  };
}

export function sqlFor(url: string) {
  return postgres(url, sqlOptionsFor(url));
}

export function createSql(env: Env) {
  return sqlFor(databaseUrl(env));
}
