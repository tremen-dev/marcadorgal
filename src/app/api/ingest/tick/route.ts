import type { Sql } from "postgres";
import { createSql } from "@/db/connect";
import { adapterFor } from "@/ingest/adapters";
import { authorizeTick } from "@/ingest/auth";
import { createIngestDb } from "@/ingest/db";
import { createTickHandler } from "@/ingest/handler";
import { runTick } from "@/ingest/tick";
import { rawStoreEnv } from "@/raw/env";
import { createStorageRawStore } from "@/raw/store";
import { SOURCES } from "@/sources/registry";

// node:zlib, postgres.js and node:fs rule out the Edge runtime (ADR-008).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The pool is opened on the first request and reused, never at import time:
// next build has to run with no DATABASE_URL in the environment (CA-11).
let pool: Sql | undefined;
const sql = () => (pool ??= createSql(process.env));

// Only POST (N-7): Vercel Cron calls by GET, and the deploy spec decides
// whether to export it here or delegate from another route.
export const POST = createTickHandler({
  authorize: (header) => authorizeTick(header, process.env),
  run: (now) =>
    runTick({
      db: createIngestDb(sql()),
      store: createStorageRawStore({ ...rawStoreEnv(process.env), fetch }),
      sources: SOURCES,
      adapterFor: (config, season) => adapterFor(config, season, process.env),
      fetch,
      now,
    }),
});
