import type { Instant, RawCapture } from "../../model/index.ts";

// SPEC-025 CA-2 (H-1): the provider's reference of each goal, out of raw that
// is already stored (the live= and ids= bodies of the tick, ADR-007). Pure:
// no request, no clock. The provider gives the minute (elapsed, extra) and the
// start of each half (fixture.periods, unix seconds), so a goal is known to a
// resolution of 60 s: minute m of a half is [start + (m-1)·60, start + m·60).

export type GoalInterval = { from: Instant; to: Instant };

// Why a goal has no interval: the provider gave no start for its half, or the
// goal is in extra time, whose halves the provider does not date.
export type NoIntervalReason = "no_periods" | "extra_time";

export type ProviderGoal = {
  // 1-based, in the order of the match: the k of the k-th goal.
  order: number;
  elapsed: number;
  extra: number | null;
  detail: string;
  teamId: string | null;
  interval: GoalInterval | null;
  reason: NoIntervalReason | null;
};

export type FixtureGoals = {
  fixtureId: string;
  leagueId: string | null;
  periods: { first: number | null; second: number | null };
  goals: ProviderGoal[];
};

type RawEvent = {
  elapsed: number;
  extra: number | null;
  detail: string;
  teamId: string | null;
};

type RawFixture = {
  fixtureId: string;
  leagueId: string | null;
  periods: { first: number | null; second: number | null };
  // home + away of the body's score, or null when it gives none.
  scored: number | null;
  events: RawEvent[] | null;
};

const HALF_MINUTES = 45;
const REGULATION_MINUTES = 90;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const intOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) ? v : null;
const idOf = (v: unknown): string | null =>
  typeof v === "number" || (typeof v === "string" && v !== "")
    ? String(v)
    : null;

const hasErrors = (errors: unknown): boolean =>
  Array.isArray(errors)
    ? errors.length > 0
    : isRecord(errors)
      ? Object.keys(errors).length > 0
      : errors !== undefined && errors !== null;

// A Goal event that really is a goal: not a missed penalty, not a shootout
// kick (which the provider also files as Goal).
function goalEvent(e: unknown): RawEvent | null {
  if (!isRecord(e) || e.type !== "Goal") return null;
  const detail = typeof e.detail === "string" ? e.detail : "";
  if (detail === "Missed Penalty") return null;
  if (e.comments === "Penalty Shootout") return null;
  const time = isRecord(e.time) ? e.time : {};
  const elapsed = intOrNull(time.elapsed);
  if (elapsed === null) return null;
  const team = isRecord(e.team) ? e.team : {};
  return {
    elapsed,
    extra: intOrNull(time.extra),
    detail,
    teamId: idOf(team.id),
  };
}

function rawFixtures(body: string): RawFixture[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || hasErrors(parsed.errors)) return [];
  if (!Array.isArray(parsed.response)) return [];
  const out: RawFixture[] = [];
  for (const item of parsed.response) {
    if (!isRecord(item) || !isRecord(item.fixture)) continue;
    const fixtureId = idOf(item.fixture.id);
    if (fixtureId === null) continue;
    const periods = isRecord(item.fixture.periods) ? item.fixture.periods : {};
    const league = isRecord(item.league) ? item.league : {};
    const goals = isRecord(item.goals) ? item.goals : {};
    const home = intOrNull(goals.home);
    const away = intOrNull(goals.away);
    out.push({
      fixtureId,
      leagueId: idOf(league.id),
      periods: {
        first: intOrNull(periods.first),
        second: intOrNull(periods.second),
      },
      scored: home === null || away === null ? null : home + away,
      events: Array.isArray(item.events)
        ? item.events.map(goalEvent).filter((g): g is RawEvent => g !== null)
        : null,
    });
  }
  return out;
}

const at = (unixSeconds: number, plusSeconds: number): Instant =>
  new Date((unixSeconds + plusSeconds) * 1000).toISOString();

function intervalOf(
  e: RawEvent,
  periods: FixtureGoals["periods"],
): Pick<ProviderGoal, "interval" | "reason"> {
  if (e.elapsed > REGULATION_MINUTES)
    return { interval: null, reason: "extra_time" };
  const firstHalf = e.elapsed <= HALF_MINUTES;
  const start = firstHalf ? periods.first : periods.second;
  if (start === null) return { interval: null, reason: "no_periods" };
  // The minute inside its half, 1-based: 45+3 is the 48th of the first half,
  // 46 the 1st of the second and 90+4 its 49th.
  const minute =
    Math.max(1, e.elapsed + (e.extra ?? 0)) - (firstHalf ? 0 : HALF_MINUTES);
  return {
    interval: {
      from: at(start, (minute - 1) * 60),
      to: at(start, minute * 60),
    },
    reason: null,
  };
}

function toGoals(fixture: RawFixture): FixtureGoals {
  const sorted = (fixture.events ?? [])
    .map((e, i) => ({ e, i }))
    .toSorted(
      (a, b) =>
        a.e.elapsed - b.e.elapsed ||
        (a.e.extra ?? 0) - (b.e.extra ?? 0) ||
        a.i - b.i,
    );
  return {
    fixtureId: fixture.fixtureId,
    leagueId: fixture.leagueId,
    periods: fixture.periods,
    goals: sorted.map(({ e }, i) => ({
      order: i + 1,
      elapsed: e.elapsed,
      extra: e.extra,
      detail: e.detail,
      teamId: e.teamId,
      ...intervalOf(e, fixture.periods),
    })),
  };
}

// The goals of every fixture of one raw body. A body that is not JSON, or
// that carries the provider's errors, gives nothing (it is not a reference).
export function goalEvents(body: string): FixtureGoals[] {
  return rawFixtures(body).map(toGoals);
}

// Whether a body's events are the whole list of its goals. Short: fewer goal
// events than its own score, or none at all when it gives no score. The
// provider sends `events: []` in some FT bodies (V-1): that is the events
// missing, not the goals gone.
const isShort = (f: RawFixture, events: RawEvent[]): boolean =>
  f.scored === null ? events.length === 0 : events.length < f.scored;

// The events to keep: the newest body's, unless they are short and an
// earlier capture had more (a goal disallowed later is gone from a complete
// list, and a complete list always replaces).
function mergedEvents(
  f: RawFixture,
  prev: RawEvent[] | null,
): RawEvent[] | null {
  if (f.events === null) return prev;
  if (prev !== null && isShort(f, f.events) && prev.length > f.events.length)
    return prev;
  return f.events;
}

// The goals of every fixture across stored captures, oldest to newest: the
// events of the newest body that has them complete (mergedEvents) and, half by half, the newest start the provider gave (it empties
// periods once the match is over).
export function goalReferences(
  captures: readonly RawCapture[],
): FixtureGoals[] {
  const merged = new Map<string, RawFixture>();
  const ordered = captures
    .map((c, i) => ({ c, i }))
    .toSorted(
      (a, b) => a.c.capturedAt.localeCompare(b.c.capturedAt) || a.i - b.i,
    );
  for (const { c } of ordered)
    for (const request of c.requests)
      for (const f of rawFixtures(request.body)) {
        const prev = merged.get(f.fixtureId);
        merged.set(f.fixtureId, {
          fixtureId: f.fixtureId,
          leagueId: f.leagueId ?? prev?.leagueId ?? null,
          periods: {
            first: f.periods.first ?? prev?.periods.first ?? null,
            second: f.periods.second ?? prev?.periods.second ?? null,
          },
          scored: f.scored ?? prev?.scored ?? null,
          events: mergedEvents(f, prev?.events ?? null),
        });
      }
  return [...merged.values()].map(toGoals);
}
