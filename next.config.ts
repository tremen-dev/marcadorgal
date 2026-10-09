import type { NextConfig } from "next";
import { BOARD_CACHE_CONTROL } from "./src/board/http.ts";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // SPEC-024 CA-6 (H-6): the Realtime switch is always inlined, "" when
  // unset, so with it off the client code of Realtime (and the Supabase URL
  // and key it would read) is dropped from the bundle.
  env: { NEXT_PUBLIC_REALTIME: process.env.NEXT_PUBLIC_REALTIME ?? "" },
  poweredByHeader: false,
  // ISR of / and /es with revalidate 10 (SPEC-020 CA-7, ADR-014 §6):
  // s-maxage=10, stale-while-revalidate=30 (expireTime minus revalidate),
  // and the same directives as /api/board, public included.
  expireTime: 40,
  async headers() {
    const cache = [{ key: "Cache-Control", value: BOARD_CACHE_CONTROL }];
    return [
      { source: "/", headers: cache },
      { source: "/es", headers: cache },
      // SPEC-027 CA-4: the week pages, ISR of 10 s on demand, the same.
      { source: "/xornada/:fecha", headers: cache },
      { source: "/es/xornada/:fecha", headers: cache },
    ];
  },
  // next dev appends a nextjs-agent-rules block to CLAUDE.md, which is a truth
  // document of the project (F-SPEC-006-5).
  agentRules: false,
  // The tick reads data/alias/<season>/<source>.json with node:fs at runtime
  // (ADR-008 §8): tracing has to carry those files into the deployment.
  outputFileTracingIncludes: {
    "/api/ingest/tick": ["./data/alias/**/*.json"],
  },
};

export default nextConfig;
