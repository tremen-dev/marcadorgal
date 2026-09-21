import { getSql } from "@/db/client";
import { adapterFor } from "@/ingest/adapters";
import { authorizeTick } from "@/ingest/auth";
import { createIngestDb } from "@/ingest/db";
import { createEngineHook, createEngineSweep } from "@/ingest/engine";
import { createTickHandler } from "@/ingest/handler";
import { runTick } from "@/ingest/tick";
import { rawStoreEnv } from "@/raw/env";
import { createStorageRawStore } from "@/raw/store";
import { SOURCES } from "@/sources/registry";

// node:zlib, postgres.js and node:fs rule out the Edge runtime (ADR-008).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The same handler for both methods (H-2, closes SPEC-006 N-7): Vercel Cron
// invokes by GET with Authorization: Bearer $CRON_SECRET, and authorizeTick
// is what guards it either way. A second route would need its own entry in
// outputFileTracingIncludes, which is indexed by path, and would deploy
// without the alias (ADR-008 §8).
export const POST = createTickHandler({
  authorize: (header) => authorizeTick(header, process.env),
  run: (now) => {
    const db = createIngestDb(getSql());
    return runTick({
      db,
      store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
      sources: SOURCES,
      adapterFor: (config, season) => adapterFor(config, season, process.env),
      fetch,
      now,
      // The engine runs twice (H-2): on what arrives and on what does not.
      afterInsert: createEngineHook(SOURCES, now),
      sweep: createEngineSweep(db, SOURCES, now),
    });
  },
});

export const GET = POST;
