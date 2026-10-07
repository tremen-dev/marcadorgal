export type Env = Record<string, string | undefined>;

export function databaseUrl(env: Env): string {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

// The local Supabase in Docker (ADR-014 §1): localhost, 127.0.0.0/8 or ::1.
// Anything that does not parse is not loopback.
export function isLoopbackUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    host === "localhost" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}
