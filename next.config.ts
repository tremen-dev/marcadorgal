import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The tick reads data/alias/<season>/<source>.json with node:fs at runtime
  // (ADR-008 §8): tracing has to carry those files into the deployment.
  outputFileTracingIncludes: {
    "/api/ingest/tick": ["./data/alias/**/*.json"],
  },
};

export default nextConfig;
