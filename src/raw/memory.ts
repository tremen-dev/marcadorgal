import type { RawStore } from "./store.ts";

export type MemoryRawStore = RawStore & {
  objects: Map<string, { body: Uint8Array; contentType: string }>;
};

// The in-memory RawStore of ADR-007 §4: the tick is proved in CI without
// Storage. An optional log records the order of the calls.
export function createMemoryRawStore(log: string[] = []): MemoryRawStore {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      log.push(`put:${key}`);
      objects.set(key, { body, contentType });
    },
    async get(key) {
      log.push(`get:${key}`);
      return objects.get(key)?.body ?? null;
    },
    async remove(keys) {
      log.push(`remove:${keys.length}`);
      for (const key of keys) objects.delete(key);
    },
  };
}
