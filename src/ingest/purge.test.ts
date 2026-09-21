import { describe, expect, it } from "vitest";
import { HOUR_MS, type Instant, shiftInstant } from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { purgeRaw } from "./purge.ts";

const NOW = "2026-09-25T18:30:00.000Z" as Instant;
const ago = (hours: number) => shiftInstant(NOW, -hours * HOUR_MS);

const keys = (n: number) =>
  Array.from({ length: n }, (_, i) => `api-football/2026-08-01/${i}.json.gz`);

// The store deletes from the catalogue too, as Storage does: without that the
// loop would never end.
function wire(stale: string[]) {
  const db = createMemoryIngestDb();
  db.stale = [...stale];
  const memory = createMemoryRawStore();
  const removed: number[] = [];
  const store = {
    ...memory,
    async remove(batch: string[]) {
      removed.push(batch.length);
      await memory.remove(batch);
      db.stale = db.stale.filter((k) => !batch.includes(k));
    },
  };
  return { db, store, removed };
}

describe("CA-8 purgeRaw", () => {
  it("removes every stale key in batches of a thousand", async () => {
    const { db, store, removed } = wire(keys(2500));
    expect(await purgeRaw({ db, store, now: NOW })).toBe("ran");
    expect(removed).toEqual([1000, 1000, 500]);
    expect(db.purges[0].close).toMatchObject({ ok: true, deleted: 2500 });
  });

  it("runs with nothing to delete", async () => {
    const { db, store, removed } = wire([]);
    expect(await purgeRaw({ db, store, now: NOW })).toBe("ran");
    expect(removed).toEqual([]);
    expect(db.purges[0].close).toMatchObject({ ok: true, deleted: 0 });
  });

  it("skips when the last successful purge is two hours old", async () => {
    const { db, store } = wire(keys(10));
    db.last = { startedAt: ago(2), ok: true };
    expect(await purgeRaw({ db, store, now: NOW })).toBe("skipped");
    expect(db.purges).toEqual([]);
  });

  it("skips when the last failed purge is half an hour old", async () => {
    const { db, store } = wire(keys(10));
    db.last = { startedAt: shiftInstant(NOW, -30 * 60_000), ok: false };
    expect(await purgeRaw({ db, store, now: NOW })).toBe("skipped");
    expect(db.purges).toEqual([]);
  });

  it("retries a failed purge an hour later", async () => {
    const { db, store } = wire(keys(10));
    db.last = { startedAt: ago(2), ok: false };
    expect(await purgeRaw({ db, store, now: NOW })).toBe("ran");
    expect(db.purges).toHaveLength(1);
  });

  it("runs again a day after a successful purge", async () => {
    const { db, store } = wire(keys(10));
    db.last = { startedAt: ago(25), ok: true };
    expect(await purgeRaw({ db, store, now: NOW })).toBe("ran");
  });

  it("records what it deleted before the failure", async () => {
    const { db, store, removed } = wire(keys(2500));
    let call = 0;
    const failing = {
      ...store,
      async remove(batch: string[]) {
        call += 1;
        if (call === 2) throw new Error("storage responded 500");
        await store.remove(batch);
      },
    };
    expect(await purgeRaw({ db, store: failing, now: NOW })).toBe("failed");
    expect(removed).toEqual([1000]);
    expect(db.purges[0].close).toMatchObject({
      ok: false,
      deleted: 1000,
      error: "storage responded 500",
    });
  });

  it("asks for the keys older than the retention", async () => {
    const { db, store } = wire([]);
    const asked: string[] = [];
    const spy = {
      ...db,
      async staleRawKeys(before: Instant, limit: number) {
        asked.push(before);
        return db.staleRawKeys(before, limit);
      },
    };
    await purgeRaw({ db: spy, store, now: NOW });
    expect(asked).toEqual(["2026-08-26T18:30:00.000Z"]);
  });
});
