import { isLoopbackHost } from "./env.ts";

// SPEC-022 CA-5 (H-2): inside the database suite fetch only reaches loopback.
// Any other host is refused before connecting, and the error names it. It does
// not cover node:http nor raw sockets (postgres.js is guarded by DATABASE_URL).
export function guardFetch(real: typeof fetch): typeof fetch {
  return (input, init) => {
    let host: string;
    try {
      const raw =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : String(input);
      host = new URL(raw).hostname;
    } catch {
      return Promise.reject(
        new Error("test:db fetch guard: not an absolute URL"),
      );
    }
    if (!isLoopbackHost(host)) {
      return Promise.reject(
        new Error(`test:db fetch guard: ${host} is not loopback`),
      );
    }
    return real(input, init);
  };
}
