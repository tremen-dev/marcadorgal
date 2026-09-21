import { afterAll, describe, expect, it } from "vitest";
import { RAW_CONTENT_TYPE } from "./capture.ts";
import { rawStoreEnv } from "./env.ts";
import { createStorageRawStore } from "./store.ts";

// CA-2: the real bucket over the REST API. Local only (npm run test:db).
const store = createStorageRawStore({ ...rawStoreEnv(process.env), fetch });
const key = `test/${crypto.randomUUID()}.json.gz`;

afterAll(() => store.remove([key]));

describe("CA-2 storage round trip", () => {
  it("puts, gets the same bytes and removes", async () => {
    const body = new Uint8Array([31, 139, 8, 0, 0, 0, 0, 0]);
    await store.put(key, body, RAW_CONTENT_TYPE);
    expect(await store.get(key)).toEqual(body);
    await store.remove([key]);
    expect(await store.get(key)).toBeNull();
  });

  it("answers null for an object that was never written", async () => {
    expect(await store.get(`test/${crypto.randomUUID()}.json.gz`)).toBeNull();
  });
});
