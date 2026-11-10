import { describe, expect, it } from "vitest";
import {
  BUFFER_ENDPOINT,
  type BufferRaw,
  bufferRequest,
  redactSecret,
} from "./client.ts";

// SPEC-067 CA-3 (ADR-030 §4-§5, §8): one POST to api.buffer.com per call,
// the bearer in the header, the raw answer back untouched. Never the network.

const KEY = "sk-sentinel-0123456789";

type Call = { url: string; init: RequestInit };

function fakeFetch(
  respond: (call: Call) => Response | Promise<Response>,
  calls: Call[] = [],
): { fetch: typeof fetch; calls: Call[] } {
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { fetch: impl, calls };
}

describe("SPEC-067 CA-3 bufferRequest", () => {
  it("POSTs the query and variables as JSON with the bearer, and returns status, headers, body and ms", async () => {
    const { fetch, calls } = fakeFetch(
      () =>
        new Response('{"data":{"account":{"id":"a-1"}}}', {
          status: 200,
          headers: { "content-type": "application/json", "x-trace": "t" },
        }),
    );
    const raw: BufferRaw = await bufferRequest(fetch, KEY, {
      query: "query { account { id } }",
      variables: { a: 1 },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(BUFFER_ENDPOINT);
    expect(calls[0].init.method).toBe("POST");
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      query: "query { account { id } }",
      variables: { a: 1 },
    });
    expect(raw.status).toBe(200);
    expect(raw.headers["content-type"]).toBe("application/json");
    expect(raw.headers["x-trace"]).toBe("t");
    expect(raw.body).toBe('{"data":{"account":{"id":"a-1"}}}');
    expect(raw.ms).toBeGreaterThanOrEqual(0);
  });

  it("keeps a non-2xx answer raw: the caller maps it", async () => {
    const { fetch } = fakeFetch(
      () =>
        new Response("Too Many Requests", {
          status: 429,
          headers: { "retry-after": "7" },
        }),
    );
    const raw = await bufferRequest(fetch, KEY, { query: "{ x }" });
    expect(raw).toMatchObject({
      status: 429,
      headers: { "retry-after": "7" },
      body: "Too Many Requests",
    });
  });

  it("passes an abort signal that fires after timeoutMs", async () => {
    const { fetch } = fakeFetch(
      (call) =>
        new Promise<Response>((_, reject) => {
          call.init.signal?.addEventListener("abort", () =>
            reject(call.init.signal?.reason),
          );
        }),
    );
    await expect(
      bufferRequest(fetch, KEY, { query: "{ x }" }, { timeoutMs: 20 }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("lets a network error through as a rejection", async () => {
    const { fetch } = fakeFetch(() =>
      Promise.reject(new TypeError("fetch failed")),
    );
    await expect(bufferRequest(fetch, KEY, { query: "{ x }" })).rejects.toThrow(
      /fetch failed/,
    );
  });
});

describe("SPEC-067 CA-3 redactSecret", () => {
  it("replaces every occurrence of the secret and leaves the rest", () => {
    expect(redactSecret(`Bearer ${KEY} and ${KEY}.`, KEY)).toBe(
      "Bearer <KEY> and <KEY>.",
    );
  });

  it("with an empty secret it changes nothing", () => {
    expect(redactSecret("Bearer x", "")).toBe("Bearer x");
  });
});
