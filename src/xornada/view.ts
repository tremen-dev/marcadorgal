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
};

export type XornadaCompetition = {
  competitionId: CompetitionId;
  name: string;
  tier: number;
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
        liveCount: group.filter((m) => m.status === "live").length,
        rows: [...group].sort(compareMatches).map(rowOf),
      };
    })
    .sort(
      (a, b) =>
        a.tier - b.tier || compareText(a.competitionId, b.competitionId),
    );
}
