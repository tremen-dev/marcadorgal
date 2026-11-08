import { describe, expect, it } from "vitest";
import {
  checkLockfile,
  checkVersionBump,
  isCalendarOnly,
} from "./version-bump";

describe("checkVersionBump (SPEC-063 CA-1)", () => {
  it.each([
    ["0.2.0", "0.2.1"],
    ["0.2.0", "0.3.0"],
    ["0.2.0", "1.0.0"],
    ["0.2.9", "0.2.10"],
    ["0.9.0", "0.10.0"],
  ])("approves %s -> %s", (base, head) => {
    expect(checkVersionBump(base, head)).toEqual({ ok: true });
  });

  it.each([
    ["0.2.0", "0.2.0"],
    ["0.2.1", "0.2.0"],
    ["0.2.9", "0.1.10"],
    ["1.0.0", "0.9.9"],
  ])("rejects %s -> %s as not-greater", (base, head) => {
    expect(checkVersionBump(base, head)).toEqual({
      ok: false,
      reason: "not-greater",
    });
  });

  const invalid = [
    "0.3.0-rc.1",
    "0.2.1+abc",
    "v0.2.1",
    "0.2",
    "01.2.3",
    "0.02.3",
    "",
  ];

  it.each(invalid)("rejects invalid head %j", (head) => {
    expect(checkVersionBump("0.2.0", head)).toEqual({
      ok: false,
      reason: "invalid-head",
    });
  });

  it.each(invalid)("rejects invalid base %j", (base) => {
    expect(checkVersionBump(base, "9.9.9")).toEqual({
      ok: false,
      reason: "invalid-base",
    });
  });
});

describe("checkLockfile (SPEC-063 CA-2)", () => {
  const lock = (root: string, pkg: string) => ({
    version: root,
    packages: { "": { version: pkg } },
  });

  it("accepts a coherent lockfile", () => {
    expect(checkLockfile({ version: "0.2.1" }, lock("0.2.1", "0.2.1"))).toEqual(
      { ok: true },
    );
  });

  it("rejects a stale lock root version", () => {
    expect(checkLockfile({ version: "0.2.1" }, lock("0.2.0", "0.2.1"))).toEqual(
      {
        ok: false,
        field: "version",
        expected: "0.2.1",
        actual: "0.2.0",
      },
    );
  });

  it('rejects a stale packages[""].version', () => {
    expect(checkLockfile({ version: "0.2.1" }, lock("0.2.1", "0.2.0"))).toEqual(
      {
        ok: false,
        field: 'packages[""].version',
        expected: "0.2.1",
        actual: "0.2.0",
      },
    );
  });

  it('rejects a lock without packages[""]', () => {
    expect(
      checkLockfile({ version: "0.2.1" }, { version: "0.2.1" }),
    ).toMatchObject({
      ok: false,
      field: 'packages[""].version',
    });
  });
});

describe("isCalendarOnly (SPEC-063 CA-3)", () => {
  it.each([
    [["data/calendario/2026-27/xornada-10.json"]],
    [["data/alias/rfef.json"]],
    [["data/calendario/a.json", "data/alias/b.json"]],
  ])("exempts %j", (paths) => {
    expect(isCalendarOnly(paths)).toBe(true);
  });

  it.each([
    [["data/calendario/a.json", "src/x.ts"]],
    [["data/calendario/a.json", "package.json"]],
    [[]],
    [["data/calendario"]],
    [["data/calendario-old/a.json"]],
  ])("does not exempt %j", (paths) => {
    expect(isCalendarOnly(paths)).toBe(false);
  });
});
