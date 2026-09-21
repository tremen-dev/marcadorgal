import "server-only";
import type { Sql } from "postgres";
import { createSql } from "./connect.ts";

// One pool per runtime, opened on first use and never at import time: next
// build collects this route with no DATABASE_URL in the environment
// (F-SPEC-006-4, SPEC-008 CA-1).
let pool: Sql | undefined;

export const getSql = (): Sql => (pool ??= createSql(process.env));
