import type { SocialDispatch } from "@/ingest/tick";
import type { Instant } from "@/model";
import { socialConfig } from "@/social/config";
import { dispatchSocial } from "@/social/dispatch";
import type { SocialDb } from "@/social/port";
import { PUBLISHERS } from "@/social/publisher";

// SPEC-066 CA-11 (ADR-030 §3, §7): what the route of the tick wires as the
// third hook. This is the one place that reads the variables and builds the
// publisher from the registry; src/ingest and src/social never meet below
// this layer (CA-12). The RNG is Math.random here, seeded in the tests of
// the dispatcher. The fetch is the route's (SPEC-067 CA-4): a named
// publisher without its secrets runs dry and the outcome says
// `unconfigured`; nothing throws for that.
export function createSocialDispatch(
  env: Readonly<Record<string, string | undefined>>,
  db: SocialDb,
  now: Instant,
  deps: { fetch: typeof fetch } = { fetch: globalThis.fetch },
): SocialDispatch {
  const config = socialConfig(env);
  const factory =
    config.publisher === null ? null : PUBLISHERS[config.publisher];
  const publisher = factory === null ? null : factory(env, deps.fetch);
  const error =
    factory !== null && publisher === null ? "unconfigured" : undefined;
  return async () => {
    const counts = await dispatchSocial({
      db,
      publisher,
      config,
      now,
      rng: Math.random,
    });
    return error === undefined ? { counts } : { counts, error };
  };
}
