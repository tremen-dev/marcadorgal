import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { type RawCapture, SourceId } from "@/model";
import { encodeCapture, rawKey, rawRef, storeCapture } from "./capture.ts";
import { rawStoreEnv } from "./env.ts";
import { createStorageRawStore } from "./store.ts";

const URL_BASE = "https://project.supabase.co";
const KEY = "service-role-key-for-the-test";
const ATTEMPT = "1f1b0c2e-0000-4000-8000-000000000001";

const capture: RawCapture = {
  sourceId: SourceId.parse("api-football"),
  capturedAt: "2026-09-26T18:30:05.123Z",
  requests: [
    {
      url: "https://v3.football.api-sports.io/fixtures?ids=1-2",
      status: 200,
      contentType: "application/json",
      body: '{"response":[]}',
    },
  ],
};

type Call = { url: string; init: RequestInit };

// A fetch stub that records every call and answers with the queued responses.
function stub(responses: Response[]) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return queue.shift() ?? new Response(null, { status: 200 });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

const store = (responses: Response[] = []) => {
  const { calls, fetch } = stub(responses);
  return {
    calls,
    raw: createStorageRawStore({
      url: URL_BASE,
      serviceRoleKey: KEY,
      fetch,
    }),
  };
};

describe("CA-2 rawKey, rawRef and encodeCapture", () => {
  it("names the object by source, day and capture instant", () => {
    expect(rawKey(capture, ATTEMPT)).toBe(
      `api-football/2026-09-26/2026-09-26T18-30-05.123Z-${ATTEMPT}.json.gz`,
    );
  });

  it("prefixes the bucket in the raw_ref", () => {
    expect(rawRef("a/b/c.json.gz")).toBe("raw/a/b/c.json.gz");
  });

  it("gzips the validated capture", () => {
    const body = encodeCapture(capture);
    expect(JSON.parse(gunzipSync(body).toString("utf8"))).toEqual(capture);
  });

  it("refuses a capture that is not a RawCapture", () => {
    expect(() =>
      encodeCapture({ ...capture, capturedAt: "not an instant" }),
    ).toThrow();
  });
});

describe("CA-2 createStorageRawStore.put", () => {
  it("posts to the object url with the service role key and no upsert", async () => {
    const { calls, raw } = store([new Response(null, { status: 200 })]);
    await raw.put("a/b.json.gz", new Uint8Array([1, 2, 3]), "application/gzip");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${URL_BASE}/storage/v1/object/raw/a/b.json.gz`);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/gzip",
      "x-upsert": "false",
    });
  });

  it("sends the gzipped capture as the body", async () => {
    const { calls, raw } = store([new Response(null, { status: 200 })]);
    await raw.put("a/b.json.gz", encodeCapture(capture), "application/gzip");
    const sent = calls[0].init.body as Uint8Array;
    expect(JSON.parse(gunzipSync(sent).toString("utf8"))).toEqual(capture);
  });

  it("throws the status without leaking the key on a non-2xx", async () => {
    const { raw } = store([new Response("boom", { status: 500 })]);
    const error = await raw
      .put("secret/key.json.gz", new Uint8Array([1]), "application/gzip")
      .catch((e: Error) => e);
    expect((error as Error).message).toBe("storage responded 500");
    expect((error as Error).message).not.toContain("secret/key.json.gz");
  });

  it("never puts the service role key in the url or the body", async () => {
    const { calls, raw } = store([new Response(null, { status: 200 })]);
    await raw.put("a/b.json.gz", encodeCapture(capture), "application/gzip");
    const withoutHeaders = calls.map(({ url, init }) => ({
      url,
      body: String(init.body),
    }));
    expect(JSON.stringify(withoutHeaders)).not.toContain(KEY);
    expect(JSON.stringify(calls[0].init.headers)).toContain(KEY);
  });
});

describe("CA-2 createStorageRawStore.get", () => {
  it("gets the object bytes", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const { calls, raw } = store([new Response(bytes, { status: 200 })]);
    expect(await raw.get("a/b.json.gz")).toEqual(bytes);
    expect(calls[0].url).toBe(`${URL_BASE}/storage/v1/object/raw/a/b.json.gz`);
    expect(calls[0].init.method).toBe("GET");
  });

  it("answers null on 404", async () => {
    const { raw } = store([new Response("nope", { status: 404 })]);
    expect(await raw.get("a/b.json.gz")).toBeNull();
  });

  // Supabase Storage wraps a missing object in a 400 whose body carries the
  // real status (F-SPEC-006-2): not found is not an error either.
  it("answers null when a 400 carries a 404 body", async () => {
    const body = JSON.stringify({
      statusCode: "404",
      error: "not_found",
      message: "Object not found",
      code: "NoSuchKey",
    });
    const { raw } = store([new Response(body, { status: 400 })]);
    expect(await raw.get("a/b.json.gz")).toBeNull();
  });

  it("throws on a 400 that is not a missing object", async () => {
    const body = JSON.stringify({ statusCode: "403", error: "Unauthorized" });
    const { raw } = store([new Response(body, { status: 400 })]);
    await expect(raw.get("a/b.json.gz")).rejects.toThrow(
      "storage responded 400",
    );
  });

  it("throws on any other non-2xx", async () => {
    const { raw } = store([new Response("nope", { status: 403 })]);
    await expect(raw.get("a/b.json.gz")).rejects.toThrow(
      "storage responded 403",
    );
  });
});

describe("CA-2 createStorageRawStore.remove", () => {
  it("deletes the keys as prefixes of the bucket", async () => {
    const { calls, raw } = store([new Response(null, { status: 200 })]);
    await raw.remove(["a/b.json.gz", "a/c.json.gz"]);
    expect(calls[0].url).toBe(`${URL_BASE}/storage/v1/object/raw`);
    expect(calls[0].init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      prefixes: ["a/b.json.gz", "a/c.json.gz"],
    });
  });

  it("does not call storage with an empty list", async () => {
    const { calls, raw } = store();
    await raw.remove([]);
    expect(calls).toEqual([]);
  });

  it("throws on a non-2xx", async () => {
    const { raw } = store([new Response(null, { status: 500 })]);
    await expect(raw.remove(["a/b.json.gz"])).rejects.toThrow(
      "storage responded 500",
    );
  });
});

describe("CA-2 storeCapture", () => {
  it("stores the capture and returns its raw_ref", async () => {
    const { calls, raw } = store([new Response(null, { status: 200 })]);
    const ref = await storeCapture(raw, capture, ATTEMPT);
    const key = rawKey(capture, ATTEMPT);
    expect(ref).toBe(rawRef(key));
    expect(calls[0].url).toBe(`${URL_BASE}/storage/v1/object/raw/${key}`);
    expect(
      JSON.parse(gunzipSync(calls[0].init.body as Uint8Array).toString("utf8")),
    ).toEqual(capture);
  });
});

describe("CA-2 rawStoreEnv", () => {
  it("reads the two variables", () => {
    expect(
      rawStoreEnv({
        NEXT_PUBLIC_SUPABASE_URL: URL_BASE,
        SUPABASE_SERVICE_ROLE_KEY: KEY,
      }),
    ).toEqual({ url: URL_BASE, serviceRoleKey: KEY });
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_URL", { SUPABASE_SERVICE_ROLE_KEY: KEY }],
    ["SUPABASE_SERVICE_ROLE_KEY", { NEXT_PUBLIC_SUPABASE_URL: URL_BASE }],
  ])("names %s when it is missing", (name, env) => {
    expect(() => rawStoreEnv(env)).toThrow(`${name} is not set`);
  });
});
