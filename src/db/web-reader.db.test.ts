import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import type { Instant } from "@/model";
import { createIngestDb } from "../ingest/db.ts";
import { getSql } from "./client.ts";
import { setWebReaderPassword } from "./web-reader.ts";

// SPEC-020 CA-3 against the local Supabase: the verifier set by
// db:web-reader lets web_reader log in, read web.xornada and nothing else.
const sql = getSql();
afterAll(() => sql.end());
const NOW = "2026-09-25T18:30:00.000Z" as Instant;

describe("SPEC-020 CA-3 setWebReaderPassword", () => {
  it("web_reader logs in with it and only reads web.xornada", async () => {
    const password = crypto.randomUUID().replaceAll("-", "");
    await setWebReaderPassword(sql, password);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.username = "web_reader";
    url.password = password;
    const reader = postgres(url.toString(), {
      ssl: false,
      prepare: false,
      max: 1,
    });
    try {
      const [{ user }] = await reader`select current_user as user`;
      expect(user).toBe("web_reader");
      await expect(
        reader`select count(*) from web.xornada`,
      ).resolves.toHaveLength(1);
      await expect(reader`select 1 from public.matches`).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await reader.end();
    }
  });
});

// SPEC-029 CA-2 and CA-3: npm run db:web-reader, run for real against the local
// Supabase from a cwd without .env, leaves web_reader with no settings of its
// own and no open session.
const root = fileURLToPath(new URL("../..", import.meta.url));
const runTool = (password: string) => {
  const env = { ...process.env };
  delete env.DATABASE_URL_PUBLIC;
  return spawnSync(
    process.execPath,
    [path.join(root, "tools", "db-web-reader.mjs")],
    {
      cwd: mkdtempSync(path.join(tmpdir(), "marcadorgal-web-reader-")),
      env: {
        ...env,
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        WEB_READER_PASSWORD: password,
      },
      encoding: "utf8",
    },
  );
};

const readerUrl = (password: string) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.username = "web_reader";
  url.password = password;
  return url.toString();
};

const settingsLeft = async () => {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole where r.rolname = 'web_reader'`;
  return count;
};

describe("SPEC-029 CA-2 db:web-reader resets the settings of web_reader", () => {
  it("leaves no row of web_reader in pg_db_role_setting, global or per database", async () => {
    await sql.unsafe("alter role web_reader set statement_timeout = '1min'");
    const [{ db }] = await sql<
      { db: string }[]
    >`select current_database() as db`;
    await sql.unsafe(
      `alter role web_reader in database "${db}" set work_mem = '64kB'`,
    );
    expect(await settingsLeft()).toBe(2);
    const password = crypto.randomUUID().replaceAll("-", "");
    const r = runTool(password);
    expect(r.status).toBe(0);
    expect(await settingsLeft()).toBe(0);
    expect(r.stdout + r.stderr).not.toContain(password);
    expect(r.stdout + r.stderr).not.toContain("64kB");
  });
});

describe("SPEC-029 CA-3 db:web-reader terminates the sessions of web_reader", () => {
  const source = `test-${crypto.randomUUID()}`;
  afterAll(() => sql`delete from ingest_attempts where source_id = ${source}`);

  it("closes a session holding the lock of openAttempt, says how many, and the tick opens", async () => {
    const old = crypto.randomUUID().replaceAll("-", "");
    await setWebReaderPassword(sql, old);
    const reader = postgres(readerUrl(old), {
      ssl: false,
      prepare: false,
      max: 1,
    });
    try {
      await reader`select pg_advisory_lock(hashtext(${`ingest_attempts:${source}`}))`;
      const db = createIngestDb(sql);
      expect(await db.openAttempt(source, NOW, 30)).toEqual({
        skipped: "locked",
      });

      const r = runTool(crypto.randomUUID().replaceAll("-", ""));
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/web_reader: 1 sesión cerrada/);

      const [{ count }] = await sql<{ count: number }[]>`
        select count(*)::int as count from pg_stat_activity
        where usename = 'web_reader'`;
      expect(count).toBe(0);
      expect(await db.openAttempt(source, NOW, 30)).toMatchObject({
        id: expect.any(String),
      });
    } finally {
      await reader.end({ timeout: 1 }).catch(() => {});
    }
  });
});
