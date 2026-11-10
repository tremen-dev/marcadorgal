import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SocialPublisher } from "../publisher.ts";
import { BUFFER_MODE, createBufferPublisher } from "./publisher.ts";

// SPEC-067 CA-3 (ADR-030 §4-§5, §8): the Buffer implementation of the port,
// mapped over the fixtures the probe captured against the real API
// (2026-11-10, test channel). Never the network: fetch is a fake that
// answers one fixture, and the key is a sentinel that must not leak.

const KEY = "sk-sentinel-0123456789";
const CHANNEL = "ch-test-1";

type Step = {
  request: { query: string; variables?: Record<string, unknown> };
  response: { status: number; headers: Record<string, string>; body: string };
};

function fixture(name: string): Step {
  const file = path.resolve(__dirname, "fixtures", `${name}.json`);
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { steps: Step[] };
  return parsed.steps[0];
}

type Call = { url: string; init: RequestInit };

function publisherWith(
  respond: (call: Call) => Response | Promise<Response>,
  options: { timeoutMs?: number } = {},
): { publisher: SocialPublisher; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return {
    publisher: createBufferPublisher({
      apiKey: KEY,
      channelId: CHANNEL,
      fetch: fetchImpl,
      ...options,
    }),
    calls,
  };
}

const answer = (step: Step) => (): Response =>
  new Response(step.response.body, {
    status: step.response.status,
    headers: step.response.headers,
  });

describe("SPEC-067 CA-3 createBufferPublisher", () => {
  it("is the publisher `buffer` and publishes with the mode fixed in CA-2: shareNow", async () => {
    const { publisher, calls } = publisherWith(
      answer(fixture("create-post-share-now")),
    );
    expect(publisher.id).toBe("buffer");
    expect(BUFFER_MODE).toBe("shareNow");
    await publisher.publish("GOL! RC Celta 1-0");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.buffer.com");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.query).toMatch(/createPost/);
    expect(sent.variables.input).toEqual({
      text: "GOL! RC Celta 1-0",
      channelId: CHANNEL,
      schedulingType: "automatic",
      mode: "shareNow",
      needsApproval: false,
      tagIds: [],
      assets: [],
    });
  });

  it("PostActionSuccess -> sent with the id of the post", async () => {
    const { publisher } = publisherWith(
      answer(fixture("create-post-share-now")),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "sent",
      providerPostId: "6af351260649793ed2f934c5",
    });
  });

  it("a MutationError (the duplicate of CA-2 d is an InvalidInputError) -> rejected with the message in one line", async () => {
    const { publisher } = publisherWith(
      answer(fixture("create-post-duplicate-2")),
    );
    const result = await publisher.publish("x");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toMatch(/^InvalidInputError: Invalid post: /);
    expect(result.reason).toMatch(/same thing twice/);
    expect(result.reason).not.toMatch(/\n/);
  });

  it("401 with an invalid key (CA-2 e) -> rejected with the status and the message", async () => {
    const { publisher } = publisherWith(
      answer(fixture("create-post-clave-invalida")),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "rejected",
      reason: "HTTP 401: Access token is not valid",
    });
  });

  it.each([
    [403, "Forbidden"],
    [400, '{"errors":[{"message":"Bad Request"}]}'],
    [404, ""],
  ])("%s and any other 4xx -> rejected", async (status, body) => {
    const { publisher } = publisherWith(() => new Response(body, { status }));
    const result = await publisher.publish("x");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toMatch(new RegExp(`^HTTP ${status}`));
  });

  it("429 -> retry with its Retry-After", async () => {
    const { publisher } = publisherWith(
      () =>
        new Response("Too Many Requests", {
          status: 429,
          headers: { "retry-after": "30" },
        }),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "retry",
      reason: "HTTP 429, Retry-After 30",
    });
  });

  it("429 without Retry-After -> retry all the same", async () => {
    const { publisher } = publisherWith(
      () => new Response("", { status: 429 }),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "retry",
      reason: "HTTP 429",
    });
  });

  it.each([500, 502, 503, 504])("%s -> retry", async (status) => {
    const { publisher } = publisherWith(
      () => new Response("<html>bad gateway</html>", { status }),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "retry",
      reason: `HTTP ${status}`,
    });
  });

  it("a 200 whose body is not the JSON expected -> unknown", async () => {
    const { publisher } = publisherWith(
      () => new Response("<html>maintenance</html>", { status: 200 }),
    );
    const result = await publisher.publish("x");
    expect(result.outcome).toBe("unknown");
  });

  it("a 200 with data but without createPost -> unknown", async () => {
    const { publisher } = publisherWith(
      () => new Response('{"data":{"account":{"id":"a"}}}', { status: 200 }),
    );
    expect((await publisher.publish("x")).outcome).toBe("unknown");
  });

  it("a 200 with top-level errors and no createPost -> rejected with the first message", async () => {
    const { publisher } = publisherWith(
      () =>
        new Response(
          '{"errors":[{"message":"Variable \\"$input\\" got invalid value"}],"data":null}',
          { status: 200 },
        ),
    );
    expect(await publisher.publish("x")).toEqual({
      outcome: "rejected",
      reason: 'GraphQL: Variable "$input" got invalid value',
    });
  });

  it("a network error -> unknown with the message", async () => {
    const { publisher } = publisherWith(() => {
      throw new TypeError("fetch failed");
    });
    expect(await publisher.publish("x")).toEqual({
      outcome: "unknown",
      reason: "fetch failed",
    });
  });

  it("an abort by the timeout -> unknown", async () => {
    const { publisher } = publisherWith(
      (call) =>
        new Promise<Response>((_, reject) => {
          call.init.signal?.addEventListener("abort", () =>
            reject(call.init.signal?.reason),
          );
        }),
      { timeoutMs: 20 },
    );
    const result = await publisher.publish("x");
    expect(result.outcome).toBe("unknown");
    if (result.outcome !== "unknown") throw new Error("unreachable");
    expect(result.reason).toMatch(/timeout|TimeoutError/i);
  });

  it("no result ever carries the key, even when the provider echoes it", async () => {
    const bodies = [
      [
        200,
        `{"data":{"createPost":{"__typename":"UnexpectedError","message":"bad ${KEY}"}}}`,
      ],
      [401, `{"errors":[{"message":"token ${KEY} invalid"}]}`],
      [500, `boom ${KEY}`],
      [200, `not json ${KEY}`],
    ] as const;
    for (const [status, body] of bodies) {
      const { publisher } = publisherWith(() => new Response(body, { status }));
      const result = await publisher.publish("x");
      expect(JSON.stringify(result)).not.toContain(KEY);
    }
    const { publisher } = publisherWith(() => {
      throw new Error(`refused ${KEY}`);
    });
    expect(JSON.stringify(await publisher.publish("x"))).not.toContain(KEY);
  });
});
