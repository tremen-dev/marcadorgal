// The raw store of ADR-007 §4: Supabase Storage over its REST API with fetch
// and the service role key, never supabase-js (ADR-001). An in-memory
// implementation lives with the tick tests; nothing here touches Postgres.

export interface RawStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(keys: string[]): Promise<void>;
}

export type StorageRawStoreOptions = {
  url: string;
  serviceRoleKey: string;
  bucket?: string;
  fetch: typeof globalThis.fetch;
};

// The key never travels in the error: it names a capture of a match we are
// about to log (ADR-007 §4).
function fail(response: Response): never {
  throw new Error(`storage responded ${response.status}`);
}

// Storage answers a missing object with a 400 whose body carries the real
// status (F-SPEC-006-2), and a plain 404 elsewhere: both mean "no object".
function isMissing(response: Response, body: string): boolean {
  if (response.status === 404) return true;
  try {
    const parsed: unknown = JSON.parse(body);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      String((parsed as { statusCode?: unknown }).statusCode) === "404"
    );
  } catch {
    return false;
  }
}

// fetch wants a body backed by a plain ArrayBuffer; gzipSync hands back a
// pooled Buffer. Re-viewing the same bytes costs nothing and copies nothing.
const asBody = (body: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength);

export function createStorageRawStore({
  url,
  serviceRoleKey,
  bucket = "raw",
  fetch,
}: StorageRawStoreOptions): RawStore {
  const base = `${url.replace(/\/+$/, "")}/storage/v1/object/${bucket}`;
  // apikey is what authenticates a sb_secret_ key; Authorization: Bearer is
  // what authenticates a legacy JWT service role key (F-SPEC-006-1).
  const auth = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  return {
    async put(key, body, contentType) {
      const response = await fetch(`${base}/${key}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": contentType, "x-upsert": "false" },
        body: asBody(body),
      });
      if (!response.ok) fail(response);
    },

    async get(key) {
      const response = await fetch(`${base}/${key}`, {
        method: "GET",
        headers: { ...auth },
      });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      if (isMissing(response, await response.text())) return null;
      fail(response);
    },

    async remove(keys) {
      if (keys.length === 0) return;
      const response = await fetch(base, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: keys }),
      });
      if (!response.ok) fail(response);
    },
  };
}
