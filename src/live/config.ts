// SPEC-024 CA-6 (H-6): the switch NEXT_PUBLIC_REALTIME, fixed at build time.
// Only the exact value «on» turns Realtime on; anything else, or nothing, is
// polling only. The anon key is already in Vercel, so it cannot be the switch.

export type RealtimeConfig = { url: string; key: string };

export function realtimeConfig(env: {
  flag: string | undefined;
  url: string | undefined;
  key: string | undefined;
}): RealtimeConfig | null {
  if (env.flag !== "on") return null;
  if (!env.url || !env.key) {
    console.error(
      "xornada: NEXT_PUBLIC_REALTIME=on without NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY: polling only",
    );
    return null;
  }
  return { url: env.url, key: env.key };
}
