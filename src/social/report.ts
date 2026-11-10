import type { Instant, MatchStatus, Qualifier, Score } from "../model/index.ts";
import type { PostKind, PostStatus, Side, TeamRef } from "./port.ts";

// SPEC-079 CA-1: the report of the social queue after a matchday, pure: no
// clock, no network, no SQL. It contrasts what the engine wrote in
// social_posts with what the rule of ADR-030 §1 says should be there. The
// rule is reimplemented here on purpose and never imported from
// src/ingest/goal-events.ts: a report that reused the engine's function
// would only ever agree with it. It reads; it never decides nor publishes
// (ADR-030 §3, D-9).

export type ReportWindow = { from: Instant; to: Instant };

export type ReportMatch = {
  id: string;
  season: string;
  kickoff: Instant;
  home: TeamRef;
  away: TeamRef;
};

export type ReportDecision = {
  id: string;
  matchId: string;
  version: number;
  status: MatchStatus;
  score: Score | null;
  qualifier: Qualifier;
  decidedAt: Instant;
};

export type ReportPost = {
  id: string;
  decisionId: string;
  matchId: string;
  side: Side;
  kind: PostKind;
  status: PostStatus;
  attempts: number;
  reason: string | null;
  templateId: string | null;
  text: string | null;
  provider: string | null;
  providerPostId: string | null;
  createdAt: Instant;
  closedAt: Instant | null;
};

// The teams watched for a season: SOCIAL_WATCHED_TEAMS or data/galegos, via
// socialConfig + watchedTeams (config.ts). The tool composes it.
export type Watched = (season: string) => ReadonlySet<string>;

export type ExpectedGoal = {
  decisionId: string;
  matchId: string;
  side: Side;
  teamId: string;
  score: Score;
  decidedAt: Instant;
};

export type ReportMode = "seco" | "encendido";
export type Verdict = "OK" | "DESVIACIONES";

export type Report = {
  window: ReportWindow;
  matches: number;
  mode: ReportMode;
  verdict: Verdict;
  deviations: string[];
  expected: (ExpectedGoal & { match: string; post: ReportPost | null })[];
  annulled: { match: string; post: ReportPost }[];
  // Goal rows of watched teams the rule does not expect: a false tweet.
  extra: ReportPost[];
  duplicates: { decisionId: string; side: Side; count: number }[];
  counts: { status: PostStatus; reason: string | null; count: number }[];
  texts: {
    postId: string;
    match: string;
    side: Side;
    kind: PostKind;
    status: PostStatus;
    text: string | null;
  }[];
};

const SIDES: readonly Side[] = ["home", "away"];

const teamOf = (m: ReportMatch, side: Side): TeamRef =>
  side === "home" ? m.home : m.away;
const label = (m: ReportMatch) => `${m.home.name} – ${m.away.name}`;

// ADR-030 §1 / SPEC-066 CA-2, for every pair of consecutive Decisions (by
// version) of a match of the window: both live, the score of the side goes
// up, the new one is confirmado, and the team of the side is watched.
export function expectedGoals(
  decisions: readonly ReportDecision[],
  matches: readonly ReportMatch[],
  watched: Watched,
): ExpectedGoal[] {
  const out: ExpectedGoal[] = [];
  for (const m of matches) {
    const teams = watched(m.season);
    const own = decisions
      .filter((d) => d.matchId === m.id)
      .sort((a, b) => a.version - b.version);
    for (let i = 1; i < own.length; i += 1) {
      const prev = own[i - 1];
      const next = own[i];
      if (prev === undefined || next === undefined) continue;
      if (prev.status !== "live" || next.status !== "live") continue;
      if (next.qualifier !== "confirmado") continue;
      if (prev.score === null || next.score === null) continue;
      for (const side of SIDES) {
        if (next.score[side] <= prev.score[side]) continue;
        const teamId = teamOf(m, side).id;
        if (!teams.has(teamId)) continue;
        out.push({
          decisionId: next.id,
          matchId: m.id,
          side,
          teamId,
          score: next.score,
          decidedAt: next.decidedAt,
        });
      }
    }
  }
  return out;
}

export function buildReport(input: {
  window: ReportWindow;
  matches: readonly ReportMatch[];
  decisions: readonly ReportDecision[];
  posts: readonly ReportPost[];
  watched: Watched;
}): Report {
  const { window, matches, decisions, posts, watched } = input;
  const byId = new Map(matches.map((m) => [m.id, m]));
  const matchOf = (p: ReportPost) => byId.get(p.matchId);
  const isWatched = (p: ReportPost) => {
    const m = matchOf(p);
    return m !== undefined && watched(m.season).has(teamOf(m, p.side).id);
  };
  const labelOf = (p: ReportPost) => {
    const m = matchOf(p);
    return m === undefined ? p.matchId : label(m);
  };
  const where = (p: ReportPost) => `${labelOf(p)} ${p.side} ${p.kind}`;
  const state = (p: ReportPost) =>
    p.reason === null ? p.status : `${p.status}/${p.reason}`;

  const inWindow = posts.filter((p) => byId.has(p.matchId));
  const watchedRows = inWindow.filter(isWatched);
  const mode: ReportMode = watchedRows.some((p) => p.status === "sent")
    ? "encendido"
    : "seco";
  const deviations: string[] = [];

  const goalRow = (e: ExpectedGoal) =>
    inWindow.find(
      (p) =>
        p.decisionId === e.decisionId && p.side === e.side && p.kind === "goal",
    ) ?? null;
  const expected = expectedGoals(decisions, matches, watched).map((e) => {
    const m = byId.get(e.matchId);
    const post = goalRow(e);
    if (post === null)
      deviations.push(
        `esperado sin fila: ${e.decisionId} ${e.side} (${m ? label(m) : e.matchId} ${e.score.home}-${e.score.away})`,
      );
    return { ...e, match: m ? label(m) : e.matchId, post };
  });
  const expectedIds = new Set(expected.map((e) => `${e.decisionId}/${e.side}`));

  const annulled = inWindow
    .filter((p) => p.kind === "goal_annulled")
    .map((post) => ({ match: labelOf(post), post }));

  const extra = watchedRows.filter(
    (p) => p.kind === "goal" && !expectedIds.has(`${p.decisionId}/${p.side}`),
  );
  for (const p of extra)
    deviations.push(
      `sobrante (tweet falso): fila ${p.id} ${where(p)} ${state(p)}`,
    );

  const seen = new Map<string, number>();
  for (const p of inWindow) {
    const key = `${p.decisionId}/${p.side}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicates = [...seen]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [decisionId = "", side = "home"] = key.split("/");
      return { decisionId, side: side as Side, count };
    });
  for (const d of duplicates)
    deviations.push(
      `duplicado: ${d.count} filas para ${d.decisionId} ${d.side}`,
    );

  // What every watched row must be, per mode (SPEC-066 CA-7 and CA-10).
  const admitted = (p: ReportPost) =>
    (mode === "seco"
      ? p.status === "skipped" && p.reason === "disabled"
      : p.status === "sent") ||
    (p.kind === "goal_annulled" &&
      p.status === "skipped" &&
      p.reason === "goal_not_posted");
  for (const p of watchedRows)
    if (!admitted(p))
      deviations.push(`fila ${p.id} ${where(p)}: ${state(p)} en modo ${mode}`);
  if (
    mode === "encendido" &&
    watchedRows.some((p) => p.status === "skipped" && p.reason === "disabled")
  )
    deviations.push("mezcla de sent y skipped/disabled en la misma ventana");

  const tally = new Map<string, Report["counts"][number]>();
  for (const p of inWindow) {
    const key = state(p);
    const row = tally.get(key) ?? {
      status: p.status,
      reason: p.reason,
      count: 0,
    };
    row.count += 1;
    tally.set(key, row);
  }
  const counts = [...tally.values()].sort((a, b) =>
    `${a.status}/${a.reason ?? ""}`.localeCompare(
      `${b.status}/${b.reason ?? ""}`,
    ),
  );

  const texts = watchedRows.map((p) => ({
    postId: p.id,
    match: labelOf(p),
    side: p.side,
    kind: p.kind,
    status: p.status,
    text: p.text,
  }));

  return {
    window,
    matches: matches.length,
    mode,
    verdict: deviations.length === 0 ? "OK" : "DESVIACIONES",
    deviations,
    expected,
    annulled,
    extra,
    duplicates,
    counts,
    texts,
  };
}

const cell = (v: string | number | null) =>
  v === null ? "—" : String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");

const POST_HEAD =
  "| fila | status | reason | attempts | template | provider | provider_post_id | created_at | closed_at | text |";
const POST_SEP = "|---|---|---|---|---|---|---|---|---|---|";
const postCells = (p: ReportPost | null) =>
  p === null
    ? "— | — | — | — | — | — | — | — | — | —"
    : [
        p.id,
        p.status,
        p.reason,
        p.attempts,
        p.templateId,
        p.provider,
        p.providerPostId,
        p.createdAt,
        p.closedAt,
        p.text,
      ]
        .map(cell)
        .join(" | ");

// The same content as the JSON, for the issue and the log.
export function renderMarkdown(r: Report): string {
  const lines: string[] = [];
  lines.push(`# Informe de redes: ${r.window.from} → ${r.window.to}`, "");
  lines.push(
    `- Partidos: ${r.matches}`,
    `- Modo: ${r.mode}`,
    `- Veredicto: ${r.verdict}`,
    "",
  );
  lines.push("## Desviaciones", "");
  if (r.deviations.length === 0) lines.push("- ninguna");
  for (const d of r.deviations) lines.push(`- ${d}`);
  lines.push("");

  lines.push(`## Goles esperados (${r.expected.length})`, "");
  lines.push(
    `| decision_id | match_id | partido | lado | equipo | marcador | decided_at ${POST_HEAD}`,
    `|---|---|---|---|---|---|---${POST_SEP}`,
  );
  for (const e of r.expected)
    lines.push(
      `| ${[e.decisionId, e.matchId, e.match, e.side, e.teamId, `${e.score.home}-${e.score.away}`, e.decidedAt].map(cell).join(" | ")} | ${postCells(e.post)} |`,
    );
  lines.push("");

  lines.push(`## Anulaciones (${r.annulled.length})`, "");
  lines.push(
    `| decision_id | match_id | partido | lado ${POST_HEAD}`,
    `|---|---|---|---${POST_SEP}`,
  );
  for (const a of r.annulled)
    lines.push(
      `| ${[a.post.decisionId, a.post.matchId, a.match, a.post.side].map(cell).join(" | ")} | ${postCells(a.post)} |`,
    );
  lines.push("");

  lines.push(`## Sobrantes (${r.extra.length})`, "");
  lines.push(
    `| decision_id | match_id | lado | kind ${POST_HEAD}`,
    `|---|---|---|---${POST_SEP}`,
  );
  for (const p of r.extra)
    lines.push(
      `| ${[p.decisionId, p.matchId, p.side, p.kind].map(cell).join(" | ")} | ${postCells(p)} |`,
    );
  lines.push("");

  lines.push(`## Duplicados (${r.duplicates.length})`, "");
  lines.push("| decision_id | lado | filas |", "|---|---|---|");
  for (const d of r.duplicates)
    lines.push(`| ${d.decisionId} | ${d.side} | ${d.count} |`);
  lines.push("");

  lines.push("## Recuento por status/reason", "");
  lines.push("| status | reason | filas |", "|---|---|---|");
  for (const c of r.counts)
    lines.push(`| ${c.status} | ${cell(c.reason)} | ${c.count} |`);
  lines.push("");

  lines.push(`## Textos de las filas vigiladas (${r.texts.length})`, "");
  for (const t of r.texts)
    lines.push(
      `- \`${t.postId}\` ${t.match} ${t.side} ${t.kind} ${t.status}: ${cell(t.text)}`,
    );
  if (r.texts.length === 0) lines.push("- ninguna");
  lines.push("");
  return lines.join("\n");
}
