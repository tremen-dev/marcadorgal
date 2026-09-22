import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";
import {
  findSecretIds,
  setupCronSecrets,
  TICK_TOKEN_SECRET,
  TICK_URL_SECRET,
} from "./cron.ts";

// CA-3 against the real vault. Until this file existed CA-3 was proven only
// with a double of sql, and the real path died on its very first statement
// with "op ANY/ALL (array) requires array on right side".

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");
const NAMES = [TICK_URL_SECRET, TICK_TOKEN_SECRET];

// Values of this test alone: nothing here is a real secret, and no assertion
// below prints one, because CA-3 asks that no value ever reach the output.
const ENV = {
  INGEST_TICK_URL: "https://example.invalid/api/ingest/tick",
  INGEST_TICK_TOKEN: "no-es-un-secreto-0123456789abcdef0123",
};

afterAll(() => sql.end());

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

describe("SPEC-008 CA-3 findSecretIds on a cold pool", () => {
  it("survives being the first statement of a brand new pool", async () => {
    // This is the case that caught the bug, and the only one that can. The
    // old code asked for the list with sql.array(), which resolves text into
    // text[] through options.shared.typeArrayMap; postgres.js fills that map
    // only once a connection has finished opening, and the parameter is built
    // while the template is assembled. npm run cron:setup is exactly this
    // shape — first statement of a fresh pool — so the value bound as text
    // and Postgres refused it.
    //
    // A transaction would hide it: begin opens the connection before the
    // callback runs, so by then the map is warm and sql.array works. Hence
    // this case is outside any transaction.
    //
    // Read-only on purpose: with the real names in play, a case that wrote
    // here would overwrite the owner's secrets once cron:setup has run.
    const cold = createSql(process.env);
    try {
      const found = await findSecretIds(cold, NAMES);
      expect(found).toBeInstanceOf(Map);
    } finally {
      await cold.end();
    }
  });
});

describe("SPEC-008 CA-3 setupCronSecrets against the real vault", () => {
  it("creates both secrets, then updates them, and leaves the right values", async () => {
    await rollback(async (tx) => {
      // A deterministic start: if the owner has already run cron:setup the
      // real rows are there and the first call would report "actualizado".
      // The delete is inside the transaction, so it is rolled back as well.
      await tx`delete from vault.secrets where name = any(${NAMES})`;

      const first = await setupCronSecrets(tx as unknown as Sql, ENV);
      expect(first).toEqual([
        `${TICK_URL_SECRET}: creado`,
        `${TICK_TOKEN_SECRET}: creado`,
      ]);

      const second = await setupCronSecrets(tx as unknown as Sql, ENV);
      expect(second).toEqual([
        `${TICK_URL_SECRET}: actualizado`,
        `${TICK_TOKEN_SECRET}: actualizado`,
      ]);

      const rows = await tx<{ name: string; decrypted_secret: string }[]>`
        select name, decrypted_secret from vault.decrypted_secrets
        where name = any(${NAMES}) order by name`;
      expect(rows.map((row) => row.name)).toEqual([...NAMES].sort());

      // Compared in code and never printed: a failure here must not spill a
      // value into the output.
      const storedValue = new Map(
        rows.map((row) => [row.name, row.decrypted_secret]),
      );
      expect(storedValue.get(TICK_URL_SECRET) === ENV.INGEST_TICK_URL).toBe(
        true,
      );
      expect(storedValue.get(TICK_TOKEN_SECRET) === ENV.INGEST_TICK_TOKEN).toBe(
        true,
      );

      const report = [...first, ...second].join("\n");
      expect(report).not.toContain(ENV.INGEST_TICK_URL);
      expect(report).not.toContain(ENV.INGEST_TICK_TOKEN);
    });
  });

  it("leaves no trace of itself in the vault once rolled back", async () => {
    // The owner's real secrets may or may not be there by now; what must
    // never be there is anything this test wrote.
    const rows = await sql<{ name: string; decrypted_secret: string }[]>`
      select name, decrypted_secret from vault.decrypted_secrets
      where name = any(${NAMES})`;
    const mine = rows.filter(
      (row) =>
        row.decrypted_secret === ENV.INGEST_TICK_URL ||
        row.decrypted_secret === ENV.INGEST_TICK_TOKEN,
    );
    expect(mine.map((row) => row.name)).toEqual([]);
  });
});
