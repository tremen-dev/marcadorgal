export type Env = Record<string, string | undefined>;

export function databaseUrl(env: Env): string {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

// The local Supabase in Docker (ADR-014 §1): localhost, 127.0.0.0/8 or ::1.
// Anything that does not parse is not loopback, and neither is a URL whose
// query names host or hostaddr: libpq and pgx (the Supabase CLI) honour them
// over the authority (SPEC-020 CA-1, V-3). Keys are compared decoded and in
// any case, so neither %68ost nor HOST slips through.
const HOST_KEYS = new Set(["host", "hostaddr"]);

export function isLoopbackUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  for (const key of parsed.searchParams.keys()) {
    if (HOST_KEYS.has(key.trim().toLowerCase())) return false;
  }
  return isLoopbackHost(parsed.hostname);
}

// A WHATWG URL hostname: localhost, 127.0.0.0/8 or [::1].
export function isLoopbackHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

// SPEC-022: `supabase status -o env` prints KEY="value" lines. The CLI v2.117
// names the Storage API URL API_URL and the service role key SERVICE_ROLE_KEY.
export function parseStatusEnv(text: string): Env {
  const out: Env = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z][A-Z0-9_]*)="(.*)"\s*$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// The local Storage the database suite must use, over any .env (SPEC-022
// CA-1). Null when the status has no loopback API_URL or no service role key:
// then test:db refuses (CA-2).
export function localStorageEnv(statusText: string): {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
} | null {
  const status = parseStatusEnv(statusText);
  const url = status.API_URL ?? "";
  const key = status.SERVICE_ROLE_KEY ?? "";
  if (!url || !key || !isLoopbackUrl(url)) return null;
  return { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key };
}

// Remote secrets the database suite never needs (SPEC-022 CA-4).
export const REMOTE_SECRETS = [
  "API_FOOTBALL_KEY",
  "INGEST_TICK_URL",
  "INGEST_TICK_TOKEN",
  "CRON_SECRET",
  "SUPABASE_ACCESS_TOKEN",
  "DATABASE_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

// Empty, not deleted: an empty variable is not overwritten by
// process.loadEnvFile() nor by Next's .env loading.
export function withoutRemoteSecrets(env: Env): Env {
  const out = { ...env };
  for (const name of REMOTE_SECRETS) out[name] = "";
  return out;
}
