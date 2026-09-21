import type { Env } from "../db/env.ts";

export type RawStoreEnv = { url: string; serviceRoleKey: string };

function required(env: Env, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// The service role key is server-only: it reaches the store by argument and
// never by module scope (ADR-007 §4).
export function rawStoreEnv(env: Env): RawStoreEnv {
  return {
    url: required(env, "NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: required(env, "SUPABASE_SERVICE_ROLE_KEY"),
  };
}
