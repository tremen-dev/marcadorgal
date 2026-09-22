import { describe, expect, it } from "vitest";
import {
  compareLiveMinute,
  MatchState,
  ParsedObservation,
  ParseResult,
  RawCapture,
  type SourceAdapter,
  SourceId,
  Unresolved,
} from "./index.ts";

const score = { home: 1, away: 0 };
const ok = (v: unknown) => MatchState.safeParse(v).success;

describe("CA-1 addedMinute in the live branch (N-8)", () => {
  it("rejects live without addedMinute", () => {
    expect(ok({ status: "live", score, minute: 45 })).toBe(false);
  });

  it.each([0, 31, 1.5])("rejects live with addedMinute %s", (addedMinute) => {
    expect(ok({ status: "live", score, minute: 45, addedMinute })).toBe(false);
  });

  it("rejects addedMinute outside live", () => {
    expect(
      ok({ status: "finished", score, minute: null, addedMinute: 3 }),
    ).toBe(false);
    expect(
      ok({ status: "scheduled", score: null, minute: null, addedMinute: 3 }),
    ).toBe(false);
    expect(
      ok({ status: "finished", score, minute: null, addedMinute: null }),
    ).toBe(false);
  });

  it("accepts live with 45+3 and with no minute at all", () => {
    expect(ok({ status: "live", score, minute: 45, addedMinute: 3 })).toBe(
      true,
    );
    expect(ok({ status: "live", score, minute: null, addedMinute: null })).toBe(
      true,
    );
  });

  it("compareLiveMinute orders (minute, addedMinute) lexicographically", () => {
    const m = (minute: number | null, addedMinute: number | null) => ({
      minute,
      addedMinute,
    });
    expect(compareLiveMinute(m(45, 3), m(46, null))).toBeLessThan(0);
    expect(compareLiveMinute(m(90, null), m(90, 1))).toBeLessThan(0);
    expect(compareLiveMinute(m(90, 5), m(91, null))).toBeLessThan(0);
    expect(compareLiveMinute(m(90, null), m(90, null))).toBe(0);
    expect(compareLiveMinute(m(46, null), m(45, 3))).toBeGreaterThan(0);
    expect(compareLiveMinute(m(null, null), m(0, null))).toBeLessThan(0);
  });
});

const sourceId = SourceId.parse("api-football");
const matchId = "tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro";
const observation = {
  matchId,
  status: "live",
  score,
  minute: 37,
  addedMinute: null,
};
const unresolved = {
  reason: "unknown_team",
  externalCompetition: "439",
  externalMatchId: "1234",
  home: { externalId: "9591", externalName: "Ourense" },
  away: { externalId: "1", externalName: "Nobody" },
  status: "1H",
};
const skipped = {
  externalMatchId: "1235",
  status: "XX",
  reason: "unsupported_status",
};
const requestError = {
  url: "https://v3.football.api-sports.io/fixtures?live=439",
  error:
    'api-football returned errors: {"live":"The Live field does not match the regular expression: [id-id-id...] or string: all."}',
};
const result = {
  observations: [observation],
  unresolved: [unresolved],
  skipped: [skipped],
  requestErrors: [requestError],
};

describe("CA-1 SourceAdapter contract types", () => {
  it("parse is mandatory on a SourceAdapter", () => {
    // @ts-expect-error a SourceAdapter without parse is not an adapter
    const adapter: SourceAdapter = {
      id: sourceId,
      kind: "pull",
      resolveTeam: () => null,
    };
    expect(adapter.kind).toBe("pull");
  });

  it("ParseResult accepts a valid result", () => {
    expect(ParseResult.safeParse(result).success).toBe(true);
    expect(
      ParseResult.safeParse({
        observations: [],
        unresolved: [],
        skipped: [],
        requestErrors: [],
      }).success,
    ).toBe(true);
  });

  // SPEC-011 CA-2: the fourth channel, mandatory, so no adapter can return a
  // result that silently has no place to put a request it could not read.
  it("ParseResult requires requestErrors, accepts [] and rejects an entry without url", () => {
    const { requestErrors: _omitted, ...without } = result;
    expect(ParseResult.safeParse(without).success).toBe(false);
    expect(ParseResult.safeParse({ ...result, requestErrors: [] }).success).toBe(
      true,
    );
    expect(
      ParseResult.safeParse({ ...result, requestErrors: [{ error: "boom" }] })
        .success,
    ).toBe(false);
    expect(
      ParseResult.safeParse({
        ...result,
        requestErrors: [{ url: "not a url", error: "boom" }],
      }).success,
    ).toBe(false);
    expect(
      ParseResult.safeParse({
        ...result,
        requestErrors: [{ ...requestError, error: "" }],
      }).success,
    ).toBe(false);
  });

  it("ParseResult rejects a scheduled observation with a score", () => {
    const bad = {
      ...result,
      observations: [{ matchId, status: "scheduled", score, minute: null }],
    };
    expect(ParseResult.safeParse(bad).success).toBe(false);
  });

  it("ParsedObservation rejects the core-owned keys rawRef and sourceId (N-1)", () => {
    expect(ParsedObservation.safeParse(observation).success).toBe(true);
    expect(
      ParsedObservation.safeParse({ ...observation, rawRef: "raw/x.json" })
        .success,
    ).toBe(false);
    expect(
      ParsedObservation.safeParse({ ...observation, sourceId: "api-football" })
        .success,
    ).toBe(false);
    expect(
      ParsedObservation.safeParse({
        ...observation,
        observedAt: "2026-09-20T16:37:00Z",
      }).success,
    ).toBe(true);
  });

  it("Unresolved rejects a reason outside the list", () => {
    expect(Unresolved.safeParse(unresolved).success).toBe(true);
    expect(
      Unresolved.safeParse({ ...unresolved, reason: "no_idea" }).success,
    ).toBe(false);
    expect(
      ParseResult.safeParse({
        ...result,
        unresolved: [{ ...unresolved, reason: "no_idea" }],
      }).success,
    ).toBe(false);
  });

  it("RawCapture accepts an empty request list", () => {
    expect(
      RawCapture.safeParse({
        sourceId: "api-football",
        capturedAt: "2026-09-20T16:37:00Z",
        requests: [],
      }).success,
    ).toBe(true);
    expect(
      RawCapture.safeParse({
        sourceId: "api-football",
        capturedAt: "2026-09-20T16:37:00Z",
        requests: [
          {
            url: "https://v3.football.api-sports.io/fixtures?live=141",
            status: 200,
            contentType: "application/json",
            body: "{}",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      RawCapture.safeParse({
        sourceId: "api-football",
        capturedAt: "2026-09-20T16:37:00Z",
        requests: [
          { url: "not a url", status: 200, contentType: null, body: "" },
        ],
      }).success,
    ).toBe(false);
  });
});
