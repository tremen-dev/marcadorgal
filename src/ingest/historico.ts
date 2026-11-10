import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import { sanitizeGoals } from "../lib/explorer-enrichment.ts";
import {
  type Candidate,
  candidateOf,
  isSameMatch,
  rowCompetitionId,
} from "../lib/explorer-identity.ts";
import {
  pickRowInWindow,
  type RowsByDay,
  rowsInWindow,
} from "../lib/explorer-window.ts";
import type {
  AliasFile,
  Instant,
  MatchStatus,
  PublicGoal,
  Score,
} from "../model/index.ts";
import { madridDateOf } from "../sources/rfef/explorer.ts";

// SPEC-060 (ADR-034), the pure half of npm run historico:sync: the arguments,
// the plan of each date against what Explorer says and the report the
// titular reviews before writing. No clock (the shell passes now), no
// network, no database: src/ingest/historico-db.ts does all of that.

export const SEASON_START = "2026-08-14";
export const HISTORICO_TOOL = "historico:sync";
export const HISTORICO_USAGE =
  "Uso: npm run historico:sync -- [--desde <YYYY-MM-DD>] [--hasta <YYYY-MM-DD>] [--dry-run]\n" +
  "  --desde  por defecto 2026-08-14; --hasta por defecto ayer (Europe/Madrid), nunca hoy ni después.";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type HistoricoArgs = {
  desde: string;
  hasta: string;
  dryRun: boolean;
};

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const previousDate = (date: string): string =>
  new Date(dayNumber(date) - DAY_MS).toISOString().slice(0, 10);

// CA-2: --hasta defaults to yesterday in Europe/Madrid and a --hasta of today
// or later is refused (ADR-034 §1: only matchdays already played).
export function parseHistoricoArgs(
  argv: readonly string[],
  now: Instant,
): HistoricoArgs {
  let desde: string | undefined;
  let hasta: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--desde" || arg === "--hasta") {
      const val = argv[i + 1];
      if (!val || !DATE_REGEX.test(val) || Number.isNaN(dayNumber(val))) {
        throw new Error(`${arg} necesita una fecha YYYY-MM-DD`);
      }
      if (arg === "--desde") desde = val;
      else hasta = val;
      i += 1;
    } else {
      throw new Error(`argumento desconocido: ${arg}`);
    }
  }

  const today = madridDateOf(now);
  const effectiveDesde = desde ?? SEASON_START;
  const effectiveHasta = hasta ?? previousDate(today);

  if (dayNumber(effectiveHasta) >= dayNumber(today)) {
    throw new Error(
      `--hasta tiene que ser anterior a hoy (${today}, Europe/Madrid)`,
    );
  }
  if (dayNumber(effectiveDesde) > dayNumber(effectiveHasta)) {
    throw new Error("--desde no puede ser posterior a --hasta");
  }

  return { desde: effectiveDesde, hasta: effectiveHasta, dryRun };
}

// CA-5: the answer of Explorer for a date, raw (it is stored before this
// runs). A non-2xx status, a body that is not JSON or one without a matches
// array is a failed date.
export type ExplorerRaw = { status: number; body: string };

export function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

export function parseExplorerDay(raw: ExplorerRaw): DayMatchesResponse {
  if (raw.status < 200 || raw.status >= 300) {
    throw new Error(`[explorer] respuesta ${raw.status}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.body);
  } catch {
    throw new Error("[explorer] respuesta inválida: no es JSON");
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { matches?: unknown }).matches)
  ) {
    throw new Error("[explorer] respuesta inválida: sin matches");
  }
  return parsed as DayMatchesResponse;
}

// A declared match of a date as the board has it: its current Decision (or
// scheduled with no score) and the goals stored in match_goals.
export type MatchToSync = {
  matchId: string;
  competitionId: string;
  round: number;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  homeShortName: string | null;
  awayName: string;
  awayShortName: string | null;
  status: MatchStatus;
  score: Score | null;
  goals: PublicGoal[];
};

type ExplorerMatch = DayMatchesResponse["matches"][number];

// Why a local match found no row (SPEC-070 CA-9): no row of its competition
// in the window, or rows of its competition but none with both of its teams.
export type UnpairedReason = "no_competition_rows" | "no_identity";

export type MatchPlan =
  | { kind: "unpaired"; match: MatchToSync; reason: UnpairedReason }
  | { kind: "ambiguous"; match: MatchToSync; candidates: Candidate[] }
  | {
      kind: "not-finished";
      match: MatchToSync;
      row: ExplorerMatch;
      // The Madrid day of the export the row came from (SPEC-071).
      rowDate: string;
      estado: string;
    }
  | {
      kind: "finished";
      match: MatchToSync;
      row: ExplorerMatch;
      rowDate: string;
      score: Score;
      // ADR-034 §2-§3: the current is not finished with this score.
      correct: boolean;
      // Valid goals of Explorer (placeholders of SPEC-059 dropped).
      goals: PublicGoal[];
      // CA-3: the valid goals of each team add up to its score.
      goalsComplete: boolean;
      // Complete and different from what is stored.
      replaceGoals: boolean;
    };

export function completeGoals(
  goals: readonly PublicGoal[],
  score: Score,
): boolean {
  const home = goals.filter((g) => g.team === "home").length;
  const away = goals.filter((g) => g.team === "away").length;
  return home === score.home && away === score.away;
}

const goalKey = (g: PublicGoal) =>
  `${g.team}|${g.minute}|${g.player}|${g.penalty === true}|${g.ownGoal === true}`;

const sameGoals = (a: readonly PublicGoal[], b: readonly PublicGoal[]) => {
  if (a.length !== b.length) return false;
  const left = a.map(goalKey).sort();
  const right = b.map(goalKey).sort();
  return left.every((k, i) => k === right[i]);
};

const sameScore = (a: Score | null, b: Score) =>
  a !== null && a.home === b.home && a.away === b.away;

// The plan of each declared match of a date (SPEC-060) against the rows of
// the window of its kickoff (SPEC-071): the identity of SPEC-070, never a
// similar name, and never the first row that fits. A plain array is the
// export of `date` alone.
export function planDaySync(
  date: string,
  localMatches: readonly MatchToSync[],
  explorerMatches: readonly ExplorerMatch[] | RowsByDay,
  aliases: AliasFile | null = null,
): MatchPlan[] {
  const rowsByDay: RowsByDay = Array.isArray(explorerMatches)
    ? new Map([[date, explorerMatches as readonly ExplorerMatch[]]])
    : (explorerMatches as RowsByDay);

  return localMatches.map((match): MatchPlan => {
    const pairing = pickRowInWindow(
      rowsByDay,
      (row) => isSameMatch(match, row, aliases),
      match.kickoff,
    );
    if (pairing.kind === "ambiguous")
      return {
        kind: "ambiguous",
        match,
        candidates: pairing.candidates.map((c) => candidateOf(c.row)),
      };
    if (pairing.kind === "unpaired") {
      const inCompetition = rowsInWindow(rowsByDay, match.kickoff).some(
        ({ row }) => rowCompetitionId(row, aliases) === match.competitionId,
      );
      return {
        kind: "unpaired",
        match,
        reason: inCompetition ? "no_identity" : "no_competition_rows",
      };
    }

    const row = pairing.row;
    const rowDate = pairing.date;
    const home = row.homeScore ?? row.golesLocal ?? null;
    const away = row.awayScore ?? row.golesVisitante ?? null;
    if (row.estado !== "FINISHED" || home === null || away === null)
      return { kind: "not-finished", match, row, rowDate, estado: row.estado };

    const score = { home, away };
    const goals = sanitizeGoals(row.goals ?? []);
    const goalsComplete = completeGoals(goals, score);
    return {
      kind: "finished",
      match,
      row,
      rowDate,
      score,
      correct: match.status !== "finished" || !sameScore(match.score, score),
      goals,
      goalsComplete,
      replaceGoals: goalsComplete && !sameGoals(goals, match.goals),
    };
  });
}

type Paired = Extract<MatchPlan, { kind: "finished" | "not-finished" }>;

const isPaired = (plan: MatchPlan): plan is Paired =>
  plan.kind === "finished" || plan.kind === "not-finished";

// One line per paired match (SPEC-070 CA-7); the day of the row after the
// declared one when they differ (SPEC-071 CA-4).
export function pairedLine(date: string, plan: Paired): string {
  const row = candidateOf(plan.row);
  const home = plan.row.homeScore ?? plan.row.golesLocal ?? null;
  const away = plan.row.awayScore ?? plan.row.golesVisitante ?? null;
  const score = home === null || away === null ? "—" : `${home}-${away}`;
  const goals =
    plan.kind === "finished"
      ? plan.goals.length
      : sanitizeGoals(plan.row.goals ?? []).length;
  return [
    plan.rowDate === date ? date : `${date} → ${plan.rowDate}`,
    plan.match.matchId,
    row.codActa ?? "sen acta",
    `${row.home ?? "?"}–${row.away ?? "?"}`,
    score,
    `${goals} goles`,
  ].join(" · ");
}

// The report of a run (CA-4, CA-5): every plan of every date read, the dates
// that failed and, if a 401/403 stopped the run, why.
export type HistoricoReport = {
  desde: string;
  hasta: string;
  dryRun: boolean;
  datesProcessed: number;
  entries: { date: string; plan: MatchPlan }[];
  failed: { date: string; error: string }[];
  aborted: string | null;
};

export function historicoFailed(report: HistoricoReport): boolean {
  return report.failed.length > 0 || report.aborted !== null;
}

const scoreText = (score: Score | null) =>
  score === null ? "" : ` ${score.home}-${score.away}`;

const head = (date: string, m: MatchToSync) =>
  `${date} · ${m.competitionId} · J${m.round} · ${m.homeName}–${m.awayName}`;

const hasChange = (
  plan: MatchPlan,
): plan is Extract<MatchPlan, { kind: "finished" }> =>
  plan.kind === "finished" && (plan.correct || plan.replaceGoals);

type Totals = { scores: number; goals: number };

function addTotals(map: Map<string, Totals>, key: string, plan: MatchPlan) {
  if (!hasChange(plan)) return;
  const totals = map.get(key) ?? { scores: 0, goals: 0 };
  if (plan.correct) totals.scores += 1;
  if (plan.replaceGoals) totals.goals += 1;
  map.set(key, totals);
}

const totalsLine = (key: string, t: Totals) =>
  `  ${key}: ${t.scores} marcadores · ${t.goals} goleadores`;

// CA-4: one line per match with a change, then the matches Explorer does not
// give FINISHED, the unmatched ones and those of incomplete goals, then the
// totals by matchday (competition + round) and by competition; CA-5: the
// failed dates and the abort, if any.
export function formatHistoricoReport(report: HistoricoReport): string[] {
  const lines: string[] = [];
  let changes = 0;
  for (const { date, plan } of report.entries) {
    if (!hasChange(plan)) continue;
    changes += 1;
    const m = plan.match;
    lines.push(
      `${head(date, m)} · ${m.status}${scoreText(m.score)} →${scoreText(plan.score)} · goles ${m.goals.length} → ${plan.goals.length}${plan.goalsComplete ? "" : " (incompletos)"}`,
    );
  }
  if (changes === 0) lines.push("Sin cambios.");

  lines.push(
    "",
    `Sin FINISHED en Explorer (${count(report, "not-finished")}):`,
  );
  for (const { date, plan } of report.entries)
    if (plan.kind === "not-finished")
      lines.push(`  ${head(date, plan.match)} · ${plan.estado}`);

  lines.push("", `Sin emparejar (${count(report, "unpaired")}):`);
  for (const { date, plan } of report.entries)
    if (plan.kind === "unpaired")
      lines.push(`  ${head(date, plan.match)} · ${plan.reason}`);

  lines.push("", `Ambiguos (${count(report, "ambiguous")}):`);
  for (const { date, plan } of report.entries)
    if (plan.kind === "ambiguous")
      lines.push(
        `  ${head(date, plan.match)} · ${plan.candidates
          .map(
            (c) =>
              `${c.codActa ?? "sen acta"} ${c.home ?? "?"}–${c.away ?? "?"}`,
          )
          .join("; ")}`,
      );

  const paired = report.entries.filter((e) => isPaired(e.plan));
  const otherDay = paired.filter(
    (e) => isPaired(e.plan) && e.plan.rowDate !== e.date,
  ).length;
  lines.push(
    "",
    `Emparejados (${paired.length}, ${otherDay} en otro día de la ventana ±3):`,
  );
  for (const { date, plan } of paired)
    if (isPaired(plan)) lines.push(`  ${pairedLine(date, plan)}`);

  const incomplete = report.entries.filter(
    (e) => e.plan.kind === "finished" && !e.plan.goalsComplete,
  );
  lines.push("", `Goles incompletos (${incomplete.length}):`);
  for (const { date, plan } of incomplete)
    if (plan.kind === "finished")
      lines.push(
        `  ${head(date, plan.match)} ·${scoreText(plan.score)} · goles válidos ${plan.goals.length}`,
      );

  const byRound = new Map<string, Totals>();
  const byCompetition = new Map<string, Totals>();
  for (const { plan } of report.entries) {
    addTotals(
      byRound,
      `${plan.match.competitionId} J${plan.match.round}`,
      plan,
    );
    addTotals(byCompetition, plan.match.competitionId, plan);
  }
  lines.push("", "Por jornada:");
  for (const [key, t] of sorted(byRound)) lines.push(totalsLine(key, t));
  lines.push("", "Por competición:");
  for (const [key, t] of sorted(byCompetition)) lines.push(totalsLine(key, t));

  if (report.failed.length > 0) {
    lines.push("", `Fechas fallidas (${report.failed.length}):`);
    for (const f of report.failed) lines.push(`  ${f.date} · ${f.error}`);
  }
  if (report.aborted !== null)
    lines.push("", `Ejecución abortada: ${report.aborted}`);
  return lines;
}

const count = (report: HistoricoReport, kind: MatchPlan["kind"]) =>
  report.entries.filter((e) => e.plan.kind === kind).length;

// By competition, then by round as a number (J2 before J10).
const sorted = (map: Map<string, Totals>) =>
  [...map].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
