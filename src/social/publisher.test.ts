import { describe, expect, it } from "vitest";
import {
  createMemoryPublisher,
  PUBLISHER_IDS,
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

  it("the registry of publishers is empty in this spec (SPEC-067 adds Buffer)", () => {
    expect(PUBLISHER_IDS).toEqual([]);
  });
});
