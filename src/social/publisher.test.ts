import { describe, expect, it } from "vitest";
import {
  createMemoryPublisher,
  PUBLISHER_IDS,
  PUBLISHERS,
  type PublishResult,
  type SocialPublisher,
} from "./publisher.ts";

// SPEC-066 CA-4 (ADR-030 §5): the port, one text in and one of four results
// out, and the double that answers a script and records what it receives.

describe("SPEC-066 CA-4 SocialPublisher and the memory double", () => {
  it("answers the script in order and records every text", async () => {
    const script: PublishResult[] = [
      { outcome: "sent", providerPostId: "p-1" },
      { outcome: "rejected", reason: "duplicate" },
      { outcome: "retry", reason: "429" },
      { outcome: "unknown", reason: "timeout" },
    ];
    const double = createMemoryPublisher(script);
    const publisher: SocialPublisher = double;
    expect(publisher.id).toBe("memory");
    const results: PublishResult[] = [];
    for (const text of ["a", "b", "c", "d"])
      results.push(await publisher.publish(text));
    expect(results).toEqual(script);
    expect(double.calls).toEqual(["a", "b", "c", "d"]);
  });

  it("past the end of the script it keeps answering the last entry", async () => {
    const double = createMemoryPublisher([
      { outcome: "sent", providerPostId: "p-1" },
    ]);
    await double.publish("a");
    expect(await double.publish("b")).toEqual({
      outcome: "sent",
      providerPostId: "p-1",
    });
    expect(double.calls).toHaveLength(2);
  });

  it("an entry may be a promise, so a test can hold a call open", async () => {
    let release!: (r: PublishResult) => void;
    const pending = new Promise<PublishResult>((r) => {
      release = r;
    });
    const double = createMemoryPublisher([pending]);
    const call = double.publish("a");
    release({ outcome: "sent", providerPostId: "late" });
    expect(await call).toEqual({ outcome: "sent", providerPostId: "late" });
  });

  it("an empty script throws: a test that gets here forgot the expectation", async () => {
    const double = createMemoryPublisher([]);
    await expect(double.publish("a")).rejects.toThrow(/script/);
  });
});

// SPEC-067 CA-4: the registry gains `buffer`, a factory over the environment
// that answers null (unconfigured) without the key or the channel.
describe("SPEC-067 CA-4 the registry of publishers", () => {
  const noFetch = (() => {
    throw new Error("no network in this test");
  }) as unknown as typeof fetch;

  it("knows buffer and nothing else", () => {
    expect(PUBLISHER_IDS).toEqual(["buffer"]);
  });

  it("buffer with key and channel is the Buffer publisher", () => {
    const publisher = PUBLISHERS.buffer(
      { BUFFER_API_KEY: "sk-x", BUFFER_CHANNEL_ID: "ch-1" },
      noFetch,
    );
    expect(publisher?.id).toBe("buffer");
  });

  it.each([
    ["without the key", { BUFFER_CHANNEL_ID: "ch-1" }],
    ["with an empty key", { BUFFER_API_KEY: " ", BUFFER_CHANNEL_ID: "ch-1" }],
    ["without the channel", { BUFFER_API_KEY: "sk-x" }],
    [
      "with an empty channel",
      { BUFFER_API_KEY: "sk-x", BUFFER_CHANNEL_ID: "" },
    ],
  ])("%s it is unconfigured: null", (_, env) => {
    expect(PUBLISHERS.buffer(env, noFetch)).toBeNull();
  });
});
