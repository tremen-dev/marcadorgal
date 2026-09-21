import { DAY_MS, HOUR_MS, type Instant, shiftInstant } from "../model/index.ts";
import type { RawStore } from "../raw/store.ts";
import {
  PURGE_BATCH,
  PURGE_EVERY_HOURS,
  PURGE_RETRY_HOURS,
  RAW_RETENTION_DAYS,
} from "./constants.ts";
import type { IngestDb } from "./db.ts";

export type PurgeOutcome = "skipped" | "ran" | "failed";

export type PurgeInput = { db: IngestDb; store: RawStore; now: Instant };

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

// Retention inside the tick (ADR-007 §5, N-4): at most once a day, retried an
// hour after a failure. The objects go through the Storage API, never through
// delete from storage.objects, which would leave the files orphaned.
export async function purgeRaw({
  db,
  store,
  now,
}: PurgeInput): Promise<PurgeOutcome> {
  const last = await db.lastPurge();
  if (last !== null) {
    const wait = (last.ok ? PURGE_EVERY_HOURS : PURGE_RETRY_HOURS) * HOUR_MS;
    if (Date.parse(now) - Date.parse(last.startedAt) < wait) return "skipped";
  }

  const id = await db.openPurge(now);
  const before = shiftInstant(now, -RAW_RETENTION_DAYS * DAY_MS);
  let deleted = 0;
  try {
    for (;;) {
      const keys = await db.staleRawKeys(before, PURGE_BATCH);
      if (keys.length === 0) break;
      await store.remove(keys);
      deleted += keys.length;
    }
  } catch (e) {
    // Never stops the ingest: the tick reads the outcome and carries on.
    await db.closePurge(id, {
      finishedAt: now,
      ok: false,
      deleted,
      error: errorMessage(e),
    });
    return "failed";
  }
  await db.closePurge(id, { finishedAt: now, ok: true, deleted });
  return "ran";
}
