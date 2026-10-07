import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "../db/client.ts";
import { authorizeTick } from "./auth.ts";

// SPEC-020 CA-9 (ADR-015 §2) against the real pg_cron job: what it leaves in
// net.http_request_queue — readable by any login through PUBLIC on net — is a
// signature authorizeTick accepts, never the token. Rolled back: the request
// is never committed, so the pg_net worker never sends it.
const sql = getSql();
const ROLLBACK = Symbol("rollback");
afterAll(() => sql.end());

// Values of this test alone; none is a real secret.
const URL_VALUE = "https://example.invalid/api/ingest/tick";
const TOKEN = "no-es-un-secreto-ca9-0123456789abcdef0123";

async function rollback(fn: (tx: TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

describe("SPEC-020 CA-9 the ingest-tick job signs instead of sending the token", () => {
  it("is still one job, every 30 seconds, signing with pgcrypto", async () => {
    const jobs = await sql<{ schedule: string; command: string }[]>`
      select schedule, command from cron.job where jobname = 'ingest-tick'`;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].schedule).toBe("30 seconds");
    expect(jobs[0].command).toContain("extensions.hmac(");
  });

  it("enqueues a header without the token that authorizeTick accepts at the database now()", () =>
    rollback(async (tx) => {
      await tx`delete from vault.secrets where name in ('ingest_tick_url', 'ingest_tick_token')`;
      await tx`select vault.create_secret(${URL_VALUE}, 'ingest_tick_url')`;
      await tx`select vault.create_secret(${TOKEN}, 'ingest_tick_token')`;

      const [{ command }] = await tx<{ command: string }[]>`
        select command from cron.job where jobname = 'ingest-tick'`;
      const [{ http_post: id }] = await tx.unsafe(command);
      const [request] = await tx<
        { url: string; headers: Record<string, string>; now: Date }[]
      >`select url, headers, now() as now from net.http_request_queue where id = ${id}`;

      expect(request.url).toBe(URL_VALUE);
      // Compared as booleans: a failure must not print the token.
      expect(JSON.stringify(request.headers).includes(TOKEN)).toBe(false);
      const authorization = request.headers.Authorization;
      expect(authorization).toMatch(/^Bearer t1\.\d+\.[0-9a-f]{64}$/);
      expect(
        authorizeTick(
          authorization,
          { INGEST_TICK_TOKEN: TOKEN },
          request.now.toISOString(),
        ),
      ).toBe("ok");
      // And another key does not.
      expect(
        authorizeTick(
          authorization,
          { INGEST_TICK_TOKEN: `${TOKEN}x` },
          request.now.toISOString(),
        ),
      ).toBe("unauthorized");
    }));
});
