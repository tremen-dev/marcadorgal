import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  cronSecrets,
  setupCronSecrets,
  TICK_TOKEN_SECRET,
  TICK_URL_SECRET,
} from "./cron.ts";

const URL_VALUE = "https://marcador.gal/api/ingest/tick";
const TOKEN_VALUE = "0123456789abcdef0123456789abcdef";
const ENV = { INGEST_TICK_URL: URL_VALUE, INGEST_TICK_TOKEN: TOKEN_VALUE };

type Call = { text: string; values: unknown[] };

// The same shape of double as src/ingest/engine.test.ts: every statement is
// recorded and the rows are canned, so what this proves is the SQL emitted.
function fakeSql(rows: (text: string) => unknown[] = () => []) {
  const calls: Call[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    return Promise.resolve(rows(text));
  };
  sql.array = (value: unknown) => value;
  return { sql: sql as unknown as Sql, calls };
}

const secretRow = (name: string) => ({
  id: `11111111-1111-4111-8111-${name.length}0000000000`,
  name,
});

describe("SPEC-008 CA-3 cronSecrets", () => {
  it("names the two secrets of the job", () => {
    expect(cronSecrets(ENV).map((s) => s.name)).toEqual([
      TICK_URL_SECRET,
      TICK_TOKEN_SECRET,
    ]);
  });

  it("throws naming INGEST_TICK_URL when it is missing", () => {
    expect(() => cronSecrets({ INGEST_TICK_TOKEN: TOKEN_VALUE })).toThrow(
      "INGEST_TICK_URL",
    );
  });

  it("throws naming INGEST_TICK_TOKEN when it is missing", () => {
    expect(() => cronSecrets({ INGEST_TICK_URL: URL_VALUE })).toThrow(
      "INGEST_TICK_TOKEN",
    );
  });
});

describe("SPEC-008 CA-3 setupCronSecrets", () => {
  it("creates both secrets when the vault is empty", async () => {
    const { sql, calls } = fakeSql();
    await setupCronSecrets(sql, ENV);
    const creates = calls.filter((c) => c.text.includes("vault.create_secret"));
    const updates = calls.filter((c) => c.text.includes("vault.update_secret"));
    expect(creates).toHaveLength(2);
    expect(updates).toHaveLength(0);
    expect(creates[0].values).toContain(URL_VALUE);
    expect(creates[1].values).toContain(TOKEN_VALUE);
  });

  it("updates both secrets when both are already there", async () => {
    const { sql, calls } = fakeSql((text) =>
      text.includes("decrypted_secrets")
        ? [secretRow(TICK_URL_SECRET), secretRow(TICK_TOKEN_SECRET)]
        : [],
    );
    await setupCronSecrets(sql, ENV);
    expect(
      calls.filter((c) => c.text.includes("vault.update_secret")),
    ).toHaveLength(2);
    expect(
      calls.filter((c) => c.text.includes("vault.create_secret")),
    ).toHaveLength(0);
  });

  it("reports the names and never a value", async () => {
    const { sql } = fakeSql((text) =>
      text.includes("decrypted_secrets") ? [secretRow(TICK_URL_SECRET)] : [],
    );
    const report = (await setupCronSecrets(sql, ENV)).join("\n");
    expect(report).toContain(TICK_URL_SECRET);
    expect(report).toContain(TICK_TOKEN_SECRET);
    expect(report).not.toContain(URL_VALUE);
    expect(report).not.toContain(TOKEN_VALUE);
  });

  it("throws before opening anything when a variable is missing", async () => {
    const { sql, calls } = fakeSql();
    await expect(setupCronSecrets(sql, {})).rejects.toThrow("INGEST_TICK_URL");
    expect(calls).toEqual([]);
  });
});

const root = fileURLToPath(new URL("../..", import.meta.url));
// A cwd without .env, so process.loadEnvFile() finds nothing.
const cleanCwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-cron-"));
const cleanEnv = { ...process.env };
for (const key of ["DATABASE_URL", "INGEST_TICK_URL", "INGEST_TICK_TOKEN"])
  delete cleanEnv[key];

describe("SPEC-008 CA-3 cron:setup", () => {
  it("exits 1 without the two variables and opens no connection", () => {
    const r = spawnSync(
      process.execPath,
      [path.join(root, "tools", "cron-setup.mjs")],
      { cwd: cleanCwd, env: cleanEnv, encoding: "utf8" },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("INGEST_TICK_URL");
    expect(r.stdout).toBe("");
  });
});
