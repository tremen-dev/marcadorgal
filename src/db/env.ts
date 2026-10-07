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
  const host = parsed.hostname;
  return (
    host === "localhost" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}
