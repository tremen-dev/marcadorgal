export type Env = Record<string, string | undefined>;

export function databaseUrl(env: Env): string {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}
