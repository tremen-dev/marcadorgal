// SPEC-066 CA-4, ADR-030 §5: the port of the outgoing integration. A
// publisher takes one text and answers one of four results; the dispatcher
// (dispatch.ts) decides what each one means for the row. Implementations:
// the memory double below, Buffer (SPEC-067) and, in reserve, the X API.
// src/social/ never imports src/decide, src/sources or src/ingest (CA-12).

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

// The registry of publishers, by the id SOCIAL_PUBLISHER names (CA-10).
// Empty in SPEC-066: every value of the variable is "off". SPEC-067 adds
// Buffer here, as a factory over the environment.
export const PUBLISHERS: Readonly<
  Record<
    string,
    (env: Readonly<Record<string, string | undefined>>) => SocialPublisher
  >
> = {};

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
