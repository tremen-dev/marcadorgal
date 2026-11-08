// Pure checks behind the version gate (SPEC-063, ADR-028). No fs, no git, no
// network: tools/version-gate.mjs feeds them what it reads.

export type BumpResult =
  | { ok: true }
  | { ok: false; reason: "invalid-base" | "invalid-head" | "not-greater" };

export type LockResult =
  | { ok: true }
  | {
      ok: false;
      field: "version" | 'packages[""].version';
      expected: string;
      actual: string | undefined;
    };

// MAJOR.MINOR.PATCH, numeric, no leading zeros, no prerelease or build.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parse(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Approves only when head is strictly greater than base. */
export function checkVersionBump(base: string, head: string): BumpResult {
  const b = parse(base);
  if (!b) return { ok: false, reason: "invalid-base" };
  const h = parse(head);
  if (!h) return { ok: false, reason: "invalid-head" };
  for (let i = 0; i < 3; i++) {
    if (h[i] > b[i]) return { ok: true };
    if (h[i] < b[i]) return { ok: false, reason: "not-greater" };
  }
  return { ok: false, reason: "not-greater" };
}

type PackageJson = { version?: unknown };
type PackageLock = {
  version?: unknown;
  packages?: Record<string, { version?: unknown } | undefined>;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/** Both lockfile version fields must equal package.json's version. */
export function checkLockfile(pkg: PackageJson, lock: PackageLock): LockResult {
  const expected = asString(pkg.version) ?? "";
  const root = asString(lock.version);
  if (root !== expected) {
    return { ok: false, field: "version", expected, actual: root };
  }
  const self = asString(lock.packages?.[""]?.version);
  if (self !== expected) {
    return { ok: false, field: 'packages[""].version', expected, actual: self };
  }
  return { ok: true };
}

const EXEMPT_PREFIXES = ["data/calendario/", "data/alias/"];

/** True only when there are changes and every one is calendar or alias data. */
export function isCalendarOnly(paths: readonly string[]): boolean {
  return (
    paths.length > 0 &&
    paths.every((path) =>
      EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix)),
    )
  );
}
