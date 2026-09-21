import { nowInstant } from "../clock.ts";
import type { Instant } from "../model/index.ts";
import type { TickAuthorization } from "./auth.ts";
import { errorMessage } from "./purge.ts";
import type { TickSummary } from "./tick.ts";

export type TickHandlerOptions = {
  authorize: (header: string | null) => TickAuthorization;
  run: (now: Instant) => Promise<TickSummary>;
};

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

// The core of the endpoint, independent of the HTTP method (N-7): the route
// exports it as POST and the deploy spec decides about GET. This is the edge
// where the clock enters (ADR-008 §7).
export function createTickHandler({ authorize, run }: TickHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    const decision = authorize(request.headers.get("authorization"));
    if (decision === "unconfigured")
      return json({ error: "tick not configured" }, 503);
    if (decision === "unauthorized")
      return json({ error: "unauthorized" }, 401);
    try {
      return json(await run(nowInstant()), 200);
    } catch (e) {
      // The message goes to the log, never to the body: it may name a host.
      console.error(`ingest tick failed: ${errorMessage(e)}`);
      return json({ error: "tick failed" }, 500);
    }
  };
}
