import type { SocialDispatch } from "@/ingest/tick";
import type { Instant } from "@/model";
import { socialConfig } from "@/social/config";
import { dispatchSocial } from "@/social/dispatch";
import type { SocialDb } from "@/social/port";
import { PUBLISHERS } from "@/social/publisher";

// SPEC-066 CA-11 (ADR-030 §3, §7): what the route of the tick wires as the
// third hook. This is the one place that reads the three variables and
// builds the publisher from the registry; src/ingest and src/social never
// meet below this layer (CA-12). The RNG is Math.random here, seeded in the
// tests of the dispatcher.
export function createSocialDispatch(
  env: Readonly<Record<string, string | undefined>>,
  db: SocialDb,
  now: Instant,
): SocialDispatch {
  const config = socialConfig(env);
  const factory =
    config.publisher === null ? null : PUBLISHERS[config.publisher];
  const publisher =
    factory === null || factory === undefined ? null : factory(env);
  return () => dispatchSocial({ db, publisher, config, now, rng: Math.random });
}
