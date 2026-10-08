import { spawnSync } from "node:child_process";
import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseWebReaderPassword, scramVerifier } from "./web-reader";

const PASSWORD = "0f3a9c2e7b5d41e8a6c09b7d3e1f2a4c";

describe("SPEC-020 CA-3 scramVerifier", () => {
  it("is the SCRAM-SHA-256 verifier Postgres stores, never the password", () => {
    const salt = Buffer.from("0123456789abcdef");
    const verifier = scramVerifier(PASSWORD, salt);
    const salted = pbkdf2Sync(PASSWORD, salt, 4096, 32, "sha256");
    const stored = createHash("sha256")
      .update(createHmac("sha256", salted).update("Client Key").digest())
      .digest("base64");
    const server = createHmac("sha256", salted)
      .update("Server Key")
      .digest("base64");
    expect(verifier).toBe(
      `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`,
    );
    expect(verifier).not.toContain(PASSWORD);
  });

  it("draws a fresh salt each time", () => {
    expect(scramVerifier(PASSWORD)).not.toBe(scramVerifier(PASSWORD));
  });
});

describe("SPEC-020 CA-3 parseWebReaderPassword", () => {
  it("accepts 16+ printable ASCII characters without spaces", () => {
    expect(parseWebReaderPassword(PASSWORD)).toBe(PASSWORD);
  });

  it.each([
    [undefined, "WEB_READER_PASSWORD is not set"],
    ["", "WEB_READER_PASSWORD is not set"],
    ["short", "at least 16"],
    ["has a space in it, sixteen+", "printable ASCII"],
    ["contraseñacontraseña", "printable ASCII"],
  ])("rejects %j", (value, message) => {
    expect(() => parseWebReaderPassword(value)).toThrow(message);
  });
});

// The shell, as in informe:jornada: a cwd without .env, and the database
// unreachable on loopback, so nothing real is touched.
describe("SPEC-020 CA-3 npm run db:web-reader", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const cwd = mkdtempSync(path.join(tmpdir(), "marcadorgal-web-reader-"));
  const base = { ...process.env };
  delete base.DATABASE_URL;
  delete base.WEB_READER_PASSWORD;
  const run = (env: Record<string, string>) =>
    spawnSync(
      process.execPath,
      [path.join(root, "tools", "db-web-reader.mjs")],
      { cwd, env: { ...base, ...env }, encoding: "utf8" },
    );

  it("is the npm script", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    );
    expect(pkg.scripts["db:web-reader"]).toBe("node tools/db-web-reader.mjs");
  });

  it("exits 1 without DATABASE_URL", () => {
    const r = run({ WEB_READER_PASSWORD: PASSWORD });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
    expect(r.stdout + r.stderr).not.toContain(PASSWORD);
  });

  it("exits 1 without WEB_READER_PASSWORD", () => {
    const r = run({ DATABASE_URL: "postgresql://u:p@127.0.0.1:1/postgres" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("WEB_READER_PASSWORD is not set");
  });

  it("never prints the password, not even when the database fails", () => {
    const r = run({
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/postgres",
      WEB_READER_PASSWORD: PASSWORD,
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain(PASSWORD);
    expect(r.stdout + r.stderr).not.toContain(PASSWORD.slice(0, 8));
  });

  it("never prints a rejected password either", () => {
    const r = run({
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/postgres",
      WEB_READER_PASSWORD: "shortsecret",
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain("shortsecret");
  });
});

describe("SPEC-020 CA-3 .env.example", () => {
  it("names DATABASE_URL_PUBLIC and WEB_READER_PASSWORD with no value", () => {
    const example = readFileSync(
      fileURLToPath(new URL("../../.env.example", import.meta.url)),
      "utf8",
    );
    expect(example).toMatch(/^DATABASE_URL_PUBLIC=$/m);
    expect(example).toMatch(/^WEB_READER_PASSWORD=$/m);
  });
});
