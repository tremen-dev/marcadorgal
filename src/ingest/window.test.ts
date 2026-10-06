import { describe, expect, it } from "vitest";
import {
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "@/model";
import {
  EXTENSION_AFTER_MINUTES,
  EXTENSION_POLL_MINUTES,
  WINDOW_AFTER_MINUTES,
  WINDOW_BEFORE_MINUTES,
} from "./constants.ts";
import {
  isDueForPoll,
  isInExtension,
  isInWindow,
  windowKickoffRange,
} from "./window.ts";

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;

// forcedFinish is the mark of the current Decision (SPEC-014 CA-8): true
// only for the forced finish of RN-02, false or null for anything else.
// decidedAt is when that Decision was decided, in minutes from kickoff, or
// null without a Decision (SPEC-018 CA-2).
const inWindow = (
  minutes: number,
  status: MatchStatus = "scheduled",
  forcedFinish: boolean | null = null,
  decidedMinutes: number | null = null,
) =>
  isInWindow(
    {
      kickoff: KICKOFF,
      status,
      forcedFinish,
      decidedAt:
        decidedMinutes === null
          ? null
          : shiftInstant(KICKOFF, decidedMinutes * MINUTE_MS),
    },
    shiftInstant(KICKOFF, minutes * MINUTE_MS),
  );

describe("CA-3 isInWindow", () => {
  it("opens ten minutes before kickoff", () => {
    expect(inWindow(-11)).toBe(false);
    expect(inWindow(-10)).toBe(true);
  });

  it("closes a hundred and fifty minutes after kickoff", () => {
    expect(inWindow(149, "live")).toBe(true);
    expect(inWindow(150, "live")).toBe(false);
  });

  it("leaves a finished match out even inside the range", () => {
    expect(inWindow(30, "finished", false)).toBe(false);
  });

  it.each<MatchStatus>(["scheduled", "live", "postponed", "suspended"])(
    "keeps a %s match inside the range",
    (status) => {
      expect(inWindow(30, status)).toBe(true);
    },
  );

  it("uses the constants of the spec", () => {
    expect([WINDOW_BEFORE_MINUTES, WINDOW_AFTER_MINUTES]).toEqual([10, 150]);
  });
});

// SPEC-013 CA-3 (ADR-010 §3): a finished forced by RN-02 is provisional and
// does not take the match out of its window; the time edge (+150) or the
// final the source confirms do. A confirmed finished still closes at once.
// Since SPEC-014 CA-8 the forced finish is told by its mark, not by its rule:
// RN-01, RN-12 and the operator write false.
describe("SPEC-013 CA-3 the forced finish keeps the window open", () => {
  it("(i) a confirmed finished at +125 is out", () => {
    expect(inWindow(125, "finished", false)).toBe(false);
    expect(inWindow(125, "finished", null)).toBe(false);
  });

  it("(ii) a finished forced by RN-02 at +125 is in", () => {
    expect(inWindow(125, "finished", true)).toBe(true);
  });

  it("(iii) the same at +151 is out: the time edge rules all the same", () => {
    expect(inWindow(150, "finished", true)).toBe(false);
    expect(inWindow(151, "finished", true)).toBe(false);
  });

  it("(iv) a live at +125 is in, as before", () => {
    expect(inWindow(125, "live", false)).toBe(true);
  });
});

// SPEC-016 CA-4 (ADR-012 §3): a postponed or a suspended published by the
// source, provisional, keeps the match in window until +150 so a wrong PST
// can still be undone; window.ts does not change to get there.
describe("SPEC-016 CA-4 postponed and suspended keep the window open", () => {
  it.each<MatchStatus>(["postponed", "suspended"])(
    "keeps a %s match in until +150 and leaves it out after",
    (status) => {
      expect(inWindow(125, status, false)).toBe(true);
      expect(inWindow(149, status, false)).toBe(true);
      expect(inWindow(150, status, false)).toBe(false);
      expect(inWindow(151, status, false)).toBe(false);
    },
  );
});

// SPEC-014 CA-8, CA-9: only the mark keeps a finished in window. A finished
// RN-02 without it — a correction of replay:jornada, or a forced finish
// written before the migration — is out; with it, in until +150. A finished
// RN-01 provisional without the mark is a confirmed finished too: out.
describe("SPEC-014 CA-8 CA-9 the window reads the mark, never the rule", () => {
  it("a finished RN-02 without the mark (false or null) is out at +125", () => {
    expect(inWindow(125, "finished", false)).toBe(false);
    expect(inWindow(125, "finished", null)).toBe(false);
  });

  it("a finished with the mark is in until +150", () => {
    expect(inWindow(121, "finished", true)).toBe(true);
    expect(inWindow(149, "finished", true)).toBe(true);
    expect(inWindow(150, "finished", true)).toBe(false);
  });

  it("does not take the rule any more", () => {
    expect(
      isInWindow(
        // @ts-expect-error rule is not part of WindowInput since SPEC-014
        { kickoff: KICKOFF, status: "finished", rule: "RN-02" },
        shiftInstant(KICKOFF, 125 * MINUTE_MS),
      ),
    ).toBe(false);
  });
});

// SPEC-018 CA-2 (ADR-013 §1, amended by N-4): a match still scheduled at
// +150 —or without a Decision, which the board reads as scheduled— stays in
// window until +360, polled every 5 minutes and only by ids= (CA-3). So does
// a live, or a finished with the mark, decided in the extension. A finished
// without the mark, a postponed or a suspended takes it out.
describe("SPEC-018 CA-2 the extension of the window", () => {
  const at = (minutes: number) => shiftInstant(KICKOFF, minutes * MINUTE_MS);

  it("uses the constants of the spec", () => {
    expect([EXTENSION_AFTER_MINUTES, EXTENSION_POLL_MINUTES]).toEqual([360, 5]);
  });

  it("(i) a scheduled match at +200 is in window", () => {
    expect(inWindow(150, "scheduled")).toBe(true);
    expect(inWindow(200, "scheduled")).toBe(true);
    expect(inWindow(359, "scheduled")).toBe(true);
  });

  it("(ii) at +360 it is out", () => {
    expect(inWindow(360, "scheduled")).toBe(false);
    expect(inWindow(361, "scheduled")).toBe(false);
  });

  it.each<[MatchStatus, boolean | null]>([
    ["finished", false],
    ["finished", null],
    ["postponed", false],
    ["suspended", false],
  ])(
    "(iii) a %s match (forced: %s) of the source at +200 is out",
    (status, forced) => {
      expect(inWindow(200, status, forced, 200)).toBe(false);
      expect(inWindow(200, status, forced, 120)).toBe(false);
    },
  );

  // F-SPEC-018-6, N-4: a live, or the finished RN-02 forces from it, decided
  // in the extension keeps the match in window so RN-12 can hear the FT of the
  // source. Decided before +150 they leave at +150 (SPEC-013 CA-3 intact).
  it.each<[MatchStatus, boolean | null]>([
    ["live", false],
    ["live", null],
    ["finished", true],
  ])(
    "(iii) a %s (forced: %s) decided at +120 is out at +200",
    (status, forced) => {
      expect(inWindow(149, status, forced, 120)).toBe(true);
      expect(inWindow(150, status, forced, 120)).toBe(false);
      expect(inWindow(200, status, forced, 120)).toBe(false);
    },
  );

  it.each<[MatchStatus, boolean | null]>([
    ["live", false],
    ["live", null],
    ["finished", true],
  ])(
    "(iii) a %s (forced: %s) decided at +200 is in at +200 and +359, out at +360",
    (status, forced) => {
      expect(inWindow(200, status, forced, 200)).toBe(true);
      expect(inWindow(359, status, forced, 200)).toBe(true);
      expect(inWindow(360, status, forced, 200)).toBe(false);
    },
  );

  it("(iii) the edge of the extension counts as decided in it", () => {
    expect(inWindow(200, "live", false, 150)).toBe(true);
    expect(inWindow(200, "live", false, 149)).toBe(false);
  });

  it("(iii) a scheduled stays in whatever its decidedAt", () => {
    expect(inWindow(200, "scheduled", false, 20)).toBe(true);
    expect(inWindow(200, "scheduled", false, null)).toBe(true);
  });

  it("(iv) at +200 the poll is due only when the last observation is 5 min old", () => {
    const due = (lastMinutes: number | null) =>
      isDueForPoll(
        {
          kickoff: KICKOFF,
          lastObservationAt: lastMinutes === null ? null : at(lastMinutes),
        },
        at(200),
      );
    expect(due(198)).toBe(false);
    expect(due(196)).toBe(false);
    expect(due(195)).toBe(true);
    expect(due(150)).toBe(true);
    expect(due(null)).toBe(true);
  });

  it("(iv) isInExtension says where the slow pace starts and ends", () => {
    const ext = (minutes: number) =>
      isInExtension({ kickoff: KICKOFF }, at(minutes));
    expect([ext(149), ext(150), ext(359), ext(360)]).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it("(v) between −10 and +150 everything is as today, and every tick polls", () => {
    for (const status of [
      "scheduled",
      "live",
      "postponed",
      "suspended",
    ] as const) {
      expect(inWindow(-11, status)).toBe(false);
      expect(inWindow(-10, status)).toBe(true);
      expect(inWindow(149, status)).toBe(true);
    }
    expect(inWindow(30, "finished", false)).toBe(false);
    for (const minutes of [-10, 0, 90, 149])
      expect(
        isDueForPoll(
          { kickoff: KICKOFF, lastObservationAt: at(minutes) },
          at(minutes),
        ),
      ).toBe(true);
  });

  it("windowKickoffRange reaches back to now minus 360 minutes", () => {
    expect(windowKickoffRange("2026-09-25T18:30:00.000Z" as Instant)).toEqual({
      from: "2026-09-25T12:30:00.000Z",
      to: "2026-09-25T18:40:00.000Z",
    });
  });
});
