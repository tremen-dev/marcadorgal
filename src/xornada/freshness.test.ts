import { describe, expect, it } from "vitest";
import type { PublicMatch } from "@/model";
import {
  ROW_AGE_MIN_MS,
  rowAge,
  screenFreshness,
  snapshotFreshness,
  transportNotice,
} from "./freshness";

// SPEC-024 CA-8 and CA-9 (D-9, RN-11, H-4, H-5): the clocks, never mixed.

const NOW = Date.parse("2026-10-10T17:00:00.000Z");
const MIN = 60_000;

describe("SPEC-024 CA-8 screenFreshness (browser clock)", () => {
  it.each([
    [0, { key: "freshness.now" }],
    [59_999, { key: "freshness.now" }],
    // A last response a little ahead of now (clock skew) is still «agora».
    [-5_000, { key: "freshness.now" }],
    [MIN, { key: "freshness.ago", n: 1 }],
    [2 * MIN + 59_999, { key: "freshness.ago", n: 2 }],
    [47 * MIN, { key: "freshness.ago", n: 47 }],
  ])("%i ms since the last response → %o", (elapsed, expected) => {
    expect(screenFreshness(NOW - elapsed, NOW)).toEqual(expected);
  });
});

describe("SPEC-024 CA-8 transportNotice", () => {
  it.each([
    // Switch off: polling is the normal mode, nothing is said.
    [{ realtime: false, mode: "polling", offline: false }, null],
    [{ realtime: false, mode: "polling", offline: true }, "freshness.offline"],
    // Switch on.
    [{ realtime: true, mode: "realtime", offline: false }, null],
    [{ realtime: true, mode: "connecting", offline: false }, null],
    [{ realtime: true, mode: "polling", offline: false }, "freshness.polling"],
    [{ realtime: true, mode: "polling", offline: true }, "freshness.offline"],
    [{ realtime: true, mode: "realtime", offline: true }, "freshness.offline"],
  ] as const)("%o → %s", (state, expected) => {
    expect(transportNotice(state)).toBe(expected);
  });
});

function live(extra: Partial<PublicMatch> = {}): PublicMatch {
  return {
    matchId: "a",
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 9,
    kickoff: "2026-10-10T16:00:00.000Z",
    home: { name: "Home", shortName: null },
    away: { name: "Away", shortName: null },
    status: "live",
    score: { home: 1, away: 0 },
    minute: 50,
    addedMinute: null,
    halfTime: false,
    qualifier: "confirmado",
    version: 2,
    observedAt: new Date(NOW - 3 * MIN - 1).toISOString(),
    decidedAt: "2026-10-10T16:55:05.000Z",
    ...extra,
  } as PublicMatch;
}

describe("SPEC-024 CA-9 rowAge (source clock, observedAt)", () => {
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it.each([
    ["live, 3 min", live(), 3],
    ["live, exactly 2 min", live({ observedAt: ago(2 * MIN) }), 2],
    [
      "live, 2 min 59 s: minutes down",
      live({ observedAt: ago(3 * MIN - 1) }),
      2,
    ],
    ["live, 1 min 59 s", live({ observedAt: ago(2 * MIN - 1) }), null],
    ["live, no observation", live({ observedAt: null }), null],
    ["half-time", live({ halfTime: true } as Partial<PublicMatch>), 3],
    [
      "sen_sinal",
      live({ qualifier: "sen_sinal", minute: null } as Partial<PublicMatch>),
      3,
    ],
    [
      "finished",
      live({
        status: "finished",
        minute: null,
        addedMinute: undefined,
        halfTime: undefined,
      } as unknown as Partial<PublicMatch>),
      null,
    ],
    [
      "scheduled",
      live({
        status: "scheduled",
        score: null,
        minute: null,
      } as unknown as Partial<PublicMatch>),
      null,
    ],
  ])("%s → %s", (_n, match, expected) => {
    expect(rowAge(match, NOW)).toBe(expected);
  });

  it("the threshold is 2 min", () => {
    expect(ROW_AGE_MIN_MS).toBe(2 * MIN);
  });
});

describe("SPEC-027 CA-5 snapshotFreshness (a week page, never live)", () => {
  const served = Date.parse("2026-10-09T18:00:00Z");
  it.each([
    [null, { key: "freshness.servedAt" }],
    [served, { key: "freshness.servedAt" }],
    [served + 59_999, { key: "freshness.servedAt" }],
    [served + 60_000, { key: "freshness.ago", n: 1 }],
    [served + 47 * 60_000 + 5_000, { key: "freshness.ago", n: 47 }],
    // A browser clock behind the server's is not «hai -1 min».
    [served - 120_000, { key: "freshness.servedAt" }],
  ])("now %s → %o", (now, out) => {
    expect(snapshotFreshness(served, now)).toEqual(out);
  });
});

// SPEC-029 CA-6 (V-7, H-5): before the transport has loaded the screen is the
// served snapshot, and nothing is announced: «Sen tempo real» flashed ~15 ms on
// every load with the switch on.
describe("SPEC-029 CA-6 transportNotice before started", () => {
  it("says nothing while the transport has not started", () => {
    expect(
      transportNotice({
        realtime: true,
        mode: "polling",
        offline: false,
        started: false,
      }),
    ).toBeNull();
  });

  it("says freshness.polling once started", () => {
    expect(
      transportNotice({
        realtime: true,
        mode: "polling",
        offline: false,
        started: true,
      }),
    ).toBe("freshness.polling");
  });
});
