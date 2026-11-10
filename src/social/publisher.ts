// SPEC-066 CA-4, ADR-030 §5: the port of the outgoing integration. A
// publisher takes one text and answers one of four results; the dispatcher
// (dispatch.ts) decides what each one means for the row. Implementations:
// the memory double below, Buffer (SPEC-067) and, in reserve, the X API.
// src/social/ never imports src/decide, src/sources or src/ingest (CA-12).

import { createBufferPublisher } from "./buffer/publisher.ts";

export type PublishResult =
  // Accepted by the provider, with its id.
  | { outcome: "sent"; providerPostId: string }
  // Refused with an answer (a mutation error, a 4xx): never retried.
  | { outcome: "rejected"; reason: string }
  // Worth another try on the next tick (429, 5xx).
  | { outcome: "retry"; reason: string }
  // No answer (timeout, network): it may or may not have gone out.
  | { outcome: "unknown"; reason: string };

export interface SocialPublisher {
  // The id stored in social_posts.provider.
  readonly id: string;
  publish(text: string): Promise<PublishResult>;
}

// The registry of publishers, by the id SOCIAL_PUBLISHER names (CA-10). A
// factory over the environment and the fetch of the route; null means the
// id is named but its secrets are missing (SPEC-067 CA-4, `unconfigured`):
// the dispatch then runs dry and the tick says so. Only Buffer so far
// (SPEC-067); the X API stays in reserve (ADR-030 §5).
export type PublisherFactory = (
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch,
) => SocialPublisher | null;

export const PUBLISHERS: Readonly<Record<string, PublisherFactory>> = {
  buffer: (env, fetchImpl) => {
    const apiKey = env.BUFFER_API_KEY?.trim() ?? "";
    const channelId = env.BUFFER_CHANNEL_ID?.trim() ?? "";
    if (apiKey === "" || channelId === "") return null;
    return createBufferPublisher({ apiKey, channelId, fetch: fetchImpl });
  },
};

export const PUBLISHER_IDS: readonly string[] = Object.keys(PUBLISHERS);

export type MemoryPublisher = SocialPublisher & {
  // Every text received, in order.
  readonly calls: string[];
};

// The double (CA-4): answers the script entry by entry and, past its end,
// repeats the last one. An entry may be a promise, so a test can hold a
// call open (the timeout of CA-6). It never touches the network.
export function createMemoryPublisher(
  script: readonly (PublishResult | Promise<PublishResult>)[],
): MemoryPublisher {
  const calls: string[] = [];
  return {
    id: "memory",
    calls,
    publish(text) {
      calls.push(text);
      if (script.length === 0)
        return Promise.reject(
          new Error("memory publisher: empty script, nothing to answer"),
        );
      const entry = script[Math.min(calls.length, script.length) - 1];
      return Promise.resolve(entry);
    },
  };
}
