import type { SocialTemplate } from "../i18n/social.gl.ts";

// SPEC-066 CA-9 (ADR-030 §6): the selector of the template. Pure: the RNG
// is a function in [0, 1) the caller gives (Math.random in the route, a
// seeded one in the tests). The excluded ids (the last text of the same kind
// of this team, and the last of the account) never come out while anything
// else is left; with nothing else left, the whole list is the pool rather
// than publishing nothing.
export type Rng = () => number;

export function pickTemplate(
  candidates: readonly SocialTemplate[],
  excluded: ReadonlySet<string>,
  rng: Rng,
): SocialTemplate {
  if (candidates.length === 0)
    throw new Error("pickTemplate: empty list of templates");
  const allowed = candidates.filter((t) => !excluded.has(t.id));
  const pool = allowed.length > 0 ? allowed : candidates;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[Math.max(0, index)];
}

// mulberry32: a small deterministic RNG for the tests and the replay.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
