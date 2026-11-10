import { describe, expect, it } from "vitest";
import type { Instant, MatchStatus, Qualifier, Score } from "../model/index.ts";
import type { PostKind, PostStatus, Side } from "./port.ts";
import {
  buildReport,
  expectedGoals,
  type ReportDecision,
  type ReportMatch,
  type ReportPost,
  renderMarkdown,
  type Watched,
} from "./report.ts";

// SPEC-079 CA-1: the pure report. expectedGoals reimplements the rule of
// ADR-030 §1 on purpose (never importing src/ingest/goal-events.ts): the
// report contrasts the engine, it does not repeat it. buildReport contrasts
// the expected goals with the rows of social_posts and gives a verdict.

const WINDOW = {
  from: "2026-11-07T00:00:00.000Z" as Instant,
  to: "2026-11-11T00:00:00.000Z" as Instant,
};
const KICKOFF = "2026-11-07T17:30:00.000Z" as Instant;

const match = (
  id: string,
  home: [string, string] = ["celta", "RC Celta"],
  away: [string, string] = ["real-madrid", "Real Madrid"],
): ReportMatch => ({
  id,
  season: "2026-27",
  kickoff: KICKOFF,
  home: { id: home[0], name: home[1] },
  away: { id: away[0], name: away[1] },
});

const decision = (
  matchId: string,
  version: number,
  status: MatchStatus,
  score: Score | null,
  qualifier: Qualifier = "confirmado",
): ReportDecision => ({
  id: `d-${matchId}-${version}`,
  matchId,
  version,
  status,
  score,
  qualifier,
  decidedAt: `2026-11-07T18:${String(version).padStart(2, "0")}:00.000Z`,
});

const post = (
  decisionId: string,
  matchId: string,
  side: Side,
  status: PostStatus,
  options: {
    id?: string;
    kind?: PostKind;
    reason?: string | null;
    text?: string | null;
    attempts?: number;
  } = {},
): ReportPost => ({
  id: options.id ?? `p-${decisionId}-${side}-${options.kind ?? "goal"}`,
  decisionId,
  matchId,
  side,
  kind: options.kind ?? "goal",
  status,
  attempts: options.attempts ?? 0,
  reason: options.reason ?? null,
  templateId: status === "pending" ? null : "goal-1",
  text:
    options.text === undefined
      ? status === "pending"
        ? null
        : `Texto de ${decisionId} ${side}`
      : options.text,
  provider: status === "sent" ? "buffer" : null,
  providerPostId: status === "sent" ? `buf-${decisionId}-${side}` : null,
  createdAt: "2026-11-07T18:10:00.000Z",
  closedAt: status === "pending" ? null : "2026-11-07T18:10:30.000Z",
});

// Celta and Deportivo watched, Real Madrid not: the same as data/galegos.
const WATCHED: Watched = () => new Set(["celta", "deportivo"]);

const live = (home: number, away: number) => ({ home, away });

describe("SPEC-079 CA-1 expectedGoals: the rule of ADR-030 §1, reimplemented", () => {
  const m = match("m1");
  const cases: [
    string,
    ReportDecision[],
    { decisionId: string; side: Side }[],
  ][] = [
    [
      "live 0-0 -> live 1-0 confirmado = goal home",
      [
        decision("m1", 1, "live", live(0, 0)),
        decision("m1", 2, "live", live(1, 0)),
      ],
      [{ decisionId: "d-m1-2", side: "home" }],
    ],
    [
      "the same, provisional = nothing",
      [
        decision("m1", 1, "live", live(0, 0)),
        decision("m1", 2, "live", live(1, 0), "provisional"),
      ],
      [],
    ],
    [
      "previous sen_sinal 1-0 -> confirmado 2-0 = goal",
      [
        decision("m1", 1, "live", live(1, 0), "sen_sinal"),
        decision("m1", 2, "live", live(2, 0)),
      ],
      [{ decisionId: "d-m1-2", side: "home" }],
    ],
    [
      "live 1-0 -> live 0-0 is an annulment, never an expected goal",
      [
        decision("m1", 1, "live", live(1, 0)),
        decision("m1", 2, "live", live(0, 0), "provisional"),
      ],
      [],
    ],
    [
      "0-0 -> 1-1 = two, home and away (both watched)",
      [
        decision("m2", 1, "live", live(0, 0)),
        decision("m2", 2, "live", live(1, 1)),
      ],
      [
        { decisionId: "d-m2-2", side: "home" },
        { decisionId: "d-m2-2", side: "away" },
      ],
    ],
    [
      "0-0 -> 2-0 = one",
      [
        decision("m1", 1, "live", live(0, 0)),
        decision("m1", 2, "live", live(2, 0)),
      ],
      [{ decisionId: "d-m1-2", side: "home" }],
    ],
    [
      "scheduled -> live 1-0 = nothing (the previous one is not live)",
      [
        decision("m1", 1, "scheduled", null),
        decision("m1", 2, "live", live(1, 0)),
      ],
      [],
    ],
    [
      "live 1-0 -> finished 2-0 = nothing (the next one is not live)",
      [
        decision("m1", 1, "live", live(1, 0)),
        decision("m1", 2, "finished", live(2, 0)),
      ],
      [],
    ],
    [
      "live 0-0 -> live 0-1 of a team that is not watched = nothing",
      [
        decision("m1", 1, "live", live(0, 0)),
        decision("m1", 2, "live", live(0, 1)),
      ],
      [],
    ],
  ];
  const m2 = match("m2", ["celta", "RC Celta"], ["deportivo", "RC Deportivo"]);

  it.each(cases)("%s", (_name, decisions, expected) => {
    const got = expectedGoals(decisions, [m, m2], WATCHED).map((e) => ({
      decisionId: e.decisionId,
      side: e.side,
    }));
    expect(got).toEqual(expected);
  });

  it("orders by version, whatever the order of the rows, and carries the team and the score", () => {
    const got = expectedGoals(
      [
        decision("m1", 2, "live", live(1, 0)),
        decision("m1", 1, "live", live(0, 0)),
      ],
      [m],
      WATCHED,
    );
    expect(got).toEqual([
      {
        decisionId: "d-m1-2",
        matchId: "m1",
        side: "home",
        teamId: "celta",
        score: { home: 1, away: 0 },
        decidedAt: "2026-11-07T18:02:00.000Z",
      },
    ]);
  });

  it("ignores the Decisions of a match outside the window", () => {
    expect(
      expectedGoals(
        [
          decision("m9", 1, "live", live(0, 0)),
          decision("m9", 2, "live", live(1, 0)),
        ],
        [m],
        WATCHED,
      ),
    ).toEqual([]);
  });

  it("asks the watched teams with the season of the match", () => {
    const seasons: string[] = [];
    const watched: Watched = (season) => {
      seasons.push(season);
      return new Set();
    };
    expectedGoals(
      [
        decision("m1", 1, "live", live(0, 0)),
        decision("m1", 2, "live", live(1, 0)),
      ],
      [{ ...m, season: "2027-28" }],
      watched,
    );
    expect(seasons).toEqual(["2027-28"]);
  });
});

// One match with a home goal (Celta, watched), an away goal (Real Madrid,
// not watched) and then a home annulment; the engine wrote a row for each.
const M = match("m1");
const DECISIONS = [
  decision("m1", 1, "live", live(0, 0)),
  decision("m1", 2, "live", live(1, 0)),
  decision("m1", 3, "live", live(1, 1)),
  decision("m1", 4, "live", live(0, 1), "provisional"),
];
const dry = {
  goal: post("d-m1-2", "m1", "home", "skipped", { reason: "disabled" }),
  foreign: post("d-m1-3", "m1", "away", "skipped", {
    reason: "not_watched",
    text: null,
  }),
  annulled: post("d-m1-4", "m1", "home", "skipped", {
    kind: "goal_annulled",
    reason: "goal_not_posted",
  }),
};
const build = (posts: ReportPost[], decisions = DECISIONS) =>
  buildReport({
    window: WINDOW,
    matches: [M],
    decisions,
    posts,
    watched: WATCHED,
  });

describe("SPEC-079 CA-1 buildReport: OK per mode", () => {
  it("dry mode: every expected goal has its row skipped/disabled with text", () => {
    const r = build([dry.goal, dry.foreign, dry.annulled]);
    expect(r.mode).toBe("seco");
    expect(r.verdict).toBe("OK");
    expect(r.deviations).toEqual([]);
    expect(r.matches).toBe(1);
    expect(r.expected).toHaveLength(1);
    expect(r.expected[0]?.post?.id).toBe(dry.goal.id);
    expect(r.annulled.map((a) => a.post.id)).toEqual([dry.annulled.id]);
    expect(r.extra).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it("on mode: every expected goal is sent; the annulment may be sent or goal_not_posted", () => {
    const sentGoal = post("d-m1-2", "m1", "home", "sent");
    const r = build([sentGoal, dry.foreign, dry.annulled]);
    expect(r.mode).toBe("encendido");
    expect(r.verdict).toBe("OK");
    const r2 = build([
      sentGoal,
      dry.foreign,
      post("d-m1-4", "m1", "home", "sent", { kind: "goal_annulled" }),
    ]);
    expect(r2.verdict).toBe("OK");
  });

  it("counts rows by status/reason and lists the texts of the watched rows only", () => {
    const r = build([dry.goal, dry.foreign, dry.annulled]);
    expect(r.counts).toEqual([
      { status: "skipped", reason: "disabled", count: 1 },
      { status: "skipped", reason: "goal_not_posted", count: 1 },
      { status: "skipped", reason: "not_watched", count: 1 },
    ]);
    expect(r.texts.map((t) => t.postId)).toEqual([
      dry.goal.id,
      dry.annulled.id,
    ]);
    expect(r.texts[0]?.text).toBe("Texto de d-m1-2 home");
  });

  it("a window without matches is OK, dry, and empty", () => {
    const r = buildReport({
      window: WINDOW,
      matches: [],
      decisions: [],
      posts: [],
      watched: WATCHED,
    });
    expect(r).toMatchObject({
      matches: 0,
      mode: "seco",
      verdict: "OK",
      expected: [],
      texts: [],
    });
  });
});

describe("SPEC-079 CA-1 buildReport: one deviation each", () => {
  const deviates = (posts: ReportPost[], re: RegExp) => {
    const r = build(posts);
    expect(r.verdict).toBe("DESVIACIONES");
    expect(r.deviations.join("\n")).toMatch(re);
    return r;
  };

  it("an expected goal without a row", () => {
    const r = deviates([dry.foreign, dry.annulled], /sin fila/);
    expect(r.expected[0]?.post).toBeNull();
  });

  it("a goal row of a watched team the rule does not expect (false tweet)", () => {
    const extra = post("d-m1-1", "m1", "home", "skipped", {
      reason: "disabled",
    });
    const r = deviates(
      [dry.goal, dry.foreign, dry.annulled, extra],
      /sobrante/,
    );
    expect(r.extra.map((p) => p.id)).toEqual([extra.id]);
  });

  it("two rows for the same (decision, side)", () => {
    const twin = { ...dry.goal, id: "p-twin" };
    const r = deviates([dry.goal, twin, dry.foreign, dry.annulled], /duplicad/);
    expect(r.duplicates).toEqual([
      { decisionId: "d-m1-2", side: "home", count: 2 },
    ]);
  });

  it.each([
    ["pending", null],
    ["sending", null],
    ["failed", "rejected"],
    ["expired", null],
    ["skipped", "not_watched"],
  ] as [PostStatus, string | null][])(
    "%s/%s on an expected goal",
    (status, reason) => {
      const row = post("d-m1-2", "m1", "home", status, { reason });
      deviates(
        [row, dry.foreign, dry.annulled],
        new RegExp(`${row.id}.*${status}`),
      );
    },
  );

  it("a mix of sent and disabled", () => {
    const m2 = match("m2", ["deportivo", "RC Deportivo"]);
    const r = buildReport({
      window: WINDOW,
      matches: [M, m2],
      decisions: [
        ...DECISIONS,
        decision("m2", 1, "live", live(0, 0)),
        decision("m2", 2, "live", live(1, 0)),
      ],
      posts: [
        post("d-m1-2", "m1", "home", "sent"),
        dry.foreign,
        dry.annulled,
        post("d-m2-2", "m2", "home", "skipped", { reason: "disabled" }),
      ],
      watched: WATCHED,
    });
    expect(r.mode).toBe("encendido");
    expect(r.verdict).toBe("DESVIACIONES");
    expect(r.deviations.join("\n")).toMatch(/mezcla/);
  });

  it("a goal_annulled row that is not skipped/goal_not_posted nor the mode's status", () => {
    deviates(
      [
        dry.goal,
        dry.foreign,
        post("d-m1-4", "m1", "home", "failed", {
          kind: "goal_annulled",
          reason: "rejected",
        }),
      ],
      /goal_annulled.*failed/,
    );
  });
});

describe("SPEC-079 CA-1 renderMarkdown", () => {
  // Every string and number of the JSON appears in the Markdown: the two
  // outputs of the tool carry the same content.
  const leaves = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === "string" || typeof value === "number")
      out.push(String(value));
    else if (Array.isArray(value)) for (const v of value) leaves(v, out);
    else if (value !== null && typeof value === "object")
      for (const v of Object.values(value)) leaves(v, out);
    return out;
  };

  it("says the same as JSON.stringify of the report, deviations included", () => {
    const r = build([
      post("d-m1-2", "m1", "home", "failed", {
        reason: "rejected",
        attempts: 3,
      }),
      dry.foreign,
      dry.annulled,
      post("d-m1-1", "m1", "home", "sent", { id: "p-extra" }),
      { ...dry.goal, id: "p-twin", status: "pending" },
    ]);
    const md = renderMarkdown(r);
    for (const leaf of leaves(JSON.parse(JSON.stringify(r))))
      expect(md).toContain(leaf);
    expect(md.split("\n")[0]).toMatch(/^# /);
  });

  it("prints the verdict and the mode of an empty window", () => {
    const md = renderMarkdown(
      buildReport({
        window: WINDOW,
        matches: [],
        decisions: [],
        posts: [],
        watched: WATCHED,
      }),
    );
    expect(md).toContain("OK");
    expect(md).toContain("seco");
    expect(md).toContain("Partidos: 0");
  });
});
