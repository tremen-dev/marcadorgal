import type {
  CompetitionId,
  Instant,
  MatchId,
  MatchStatus,
  PublicMatch,
  Qualifier,
  Score,
} from "@/model";

// The pure view model of the Xornada screen (SPEC-019 CA-2): no clock, no
// locale, no i18n. It returns i18n keys; the components resolve them.

export type Margin =
  | { kind: "time"; kickoff: Instant }
  | { kind: "minute"; minute: number; addedMinute: number | null }
  // SPEC-021: half-time, a moment inside live with no minute to run. The
  // source's minute is kept in the data (N-3) and silenced here.
  | { kind: "halfTime" }
  | { kind: "status" };

export type StatusKey = `status.${MatchStatus}`;
export type QualifierKey = `qualifier.${Exclude<Qualifier, "confirmado">}`;

export type XornadaRow = {
  matchId: MatchId;
  status: MatchStatus;
  qualifier: Qualifier;
  home: string;
  away: string;
  score: Score | null;
  margin: Margin;
  statusKey: StatusKey;
  qualifierKey: QualifierKey | null;
  winner: "home" | "away" | null;
  // SPEC-023 CA-1: the Madrid date of the kickoff, YYYY-MM-DD.
  day: string;
};

export type XornadaCompetition = {
  competitionId: CompetitionId;
  name: string;
  tier: number;
  // SPEC-023 CA-1: the most frequent round of its rows; a tie, the lower.
  round: number;
  liveCount: number;
  rows: XornadaRow[];
};

// H-2: the design's order (Movil.tpl.html).
const ROW_ORDER: Readonly<Record<MatchStatus, number>> = {
  live: 0,
  finished: 1,
  suspended: 2,
  scheduled: 3,
  postponed: 4,
};

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

function compareMatches(a: PublicMatch, b: PublicMatch): number {
  return (
    ROW_ORDER[a.status] - ROW_ORDER[b.status] ||
    compareText(a.kickoff, b.kickoff) ||
    compareText(a.matchId, b.matchId)
  );
}

function marginOf(m: PublicMatch): Margin {
  if (m.status === "scheduled") return { kind: "time", kickoff: m.kickoff };
  if (m.status === "live" && m.halfTime) return { kind: "halfTime" };
  if (m.status === "live" && m.minute !== null)
    return { kind: "minute", minute: m.minute, addedMinute: m.addedMinute };
  return { kind: "status" };
}

function winnerOf(m: PublicMatch): XornadaRow["winner"] {
  if (m.status !== "finished") return null;
  if (m.score.home > m.score.away) return "home";
  if (m.score.away > m.score.home) return "away";
  return null;
}

function rowOf(m: PublicMatch): XornadaRow {
  return {
    matchId: m.matchId,
    status: m.status,
    qualifier: m.qualifier,
    home: m.home.shortName ?? m.home.name,
    away: m.away.shortName ?? m.away.name,
    score: m.score,
    margin: marginOf(m),
    statusKey: `status.${m.status}`,
    qualifierKey:
      m.qualifier === "confirmado" ? null : `qualifier.${m.qualifier}`,
    winner: winnerOf(m),
    day: madridDate(m.kickoff),
  };
}

// «45+3'» and «46'»: the added time is never folded into the minute (N-8).
export function minuteLabel(
  minute: Pick<Extract<Margin, { kind: "minute" }>, "minute" | "addedMinute">,
): string {
  return minute.addedMinute === null
    ? `${minute.minute}'`
    : `${minute.minute}+${minute.addedMinute}'`;
}

// Competitions by tier ascending (H-1), then by id for a stable order.
export function buildXornada(matches: PublicMatch[]): XornadaCompetition[] {
  const byCompetition = new Map<CompetitionId, PublicMatch[]>();
  for (const m of matches) {
    const group = byCompetition.get(m.competitionId) ?? [];
    group.push(m);
    byCompetition.set(m.competitionId, group);
  }
  return [...byCompetition.values()]
    .map((group) => {
      const [first] = group;
      return {
        competitionId: first.competitionId,
        name: first.competitionName,
        tier: first.tier,
        round: roundOf(group),
        liveCount: group.filter((m) => m.status === "live").length,
        rows: [...group].sort(compareMatches).map(rowOf),
      };
    })
    .sort(
      (a, b) =>
        a.tier - b.tier || compareText(a.competitionId, b.competitionId),
    );
}

function roundOf(group: PublicMatch[]): number {
  const counts = new Map<number, number>();
  for (const m of group) counts.set(m.round, (counts.get(m.round) ?? 0) + 1);
  let best = { round: Number.POSITIVE_INFINITY, n: 0 };
  for (const [round, n] of counts) {
    if (n > best.n || (n === best.n && round < best.round)) best = { round, n };
  }
  return best.round;
}

// SPEC-023 CA-1: the days of the xornada. Dates are civil dates of
// Europe/Madrid; formatting them into words is the components' job (i18n).
const TIME_ZONE = "Europe/Madrid";
const MADRID_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// The civil date of an instant in Europe/Madrid, YYYY-MM-DD.
export function madridDate(instant: Instant): string {
  const parts = MADRID_DATE.formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type WeekdayKey = `weekday.${Weekday}`;

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;
export type Month = (typeof MONTHS)[number];
export type MonthKey = `month.${Month}`;

export type XornadaDay = {
  date: string;
  weekdayKey: WeekdayKey;
  dayOfMonth: number;
  monthKey: MonthKey;
  // SPEC-023 B-2: the month is not the month of today (YYYY-MM, Madrid), so
  // the strip says it («sáb 12 set» next to «ven 9»).
  otherMonth: boolean;
  today: boolean;
};

function dayOf(date: string, today: string): XornadaDay {
  const [year, month, day] = date.split("-").map(Number);
  const weekday =
    WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return {
    date,
    weekdayKey: `weekday.${weekday}`,
    dayOfMonth: day,
    monthKey: `month.${MONTHS[month - 1]}`,
    otherMonth: date.slice(0, 7) !== today.slice(0, 7),
    today: date === today,
  };
}

// The distinct Madrid dates of the kickoffs, ascending. `now` only marks today.
export function xornadaDays(
  matches: readonly Pick<PublicMatch, "kickoff">[],
  now: Instant,
): XornadaDay[] {
  const today = madridDate(now);
  return [...new Set(matches.map((m) => madridDate(m.kickoff)))]
    .sort(compareText)
    .map((date) => dayOf(date, today));
}
