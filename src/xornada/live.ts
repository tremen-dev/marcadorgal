import type { Instant, MatchId, PublicMatch } from "@/model";
import { type XornadaDay, xornadaDays } from "./view";

// SPEC-024 CA-4 (H-1, H-7): the state of the screen in the client, pure. One
// PublicMatch per matchId; a delta or a row of /api/board replaces the
// painted one only with a higher version (ADR-014 §5). Membership (which
// matches are on screen) and the days change only with a 200 of /api/board.

export type LiveBoard = {
  readonly matches: ReadonlyMap<MatchId, PublicMatch>;
  readonly days: readonly XornadaDay[];
  // Browser clock (ms) of the last request asked by an unknown matchId.
  readonly lastUnknownRequest: number | null;
};

// An unknown matchId asks /api/board at most once every 30 s.
export const UNKNOWN_REQUEST_MS = 30_000;

export function initialBoard(
  matches: readonly PublicMatch[],
  days: readonly XornadaDay[],
): LiveBoard {
  return {
    matches: new Map(matches.map((m) => [m.matchId, m])),
    days,
    lastUnknownRequest: null,
  };
}

export const boardMatches = (board: LiveBoard): PublicMatch[] => [
  ...board.matches.values(),
];

export function applyDelta(
  board: LiveBoard,
  match: PublicMatch,
  now: number,
): { board: LiveBoard; request: boolean } {
  const painted = board.matches.get(match.matchId);
  if (painted === undefined) {
    const last = board.lastUnknownRequest;
    if (last !== null && now - last < UNKNOWN_REQUEST_MS)
      return { board, request: false };
    return { board: { ...board, lastUnknownRequest: now }, request: true };
  }
  if (match.version <= painted.version) return { board, request: false };
  const matches = new Map(board.matches);
  matches.set(match.matchId, match);
  return { board: { ...board, matches }, request: false };
}

// A 200 of /api/board: its list is the membership. A cached response may be
// older than a delta already painted: the higher version stays.
export function applyBoard(
  board: LiveBoard,
  list: readonly PublicMatch[],
  now: Instant,
): LiveBoard {
  const matches = new Map<MatchId, PublicMatch>();
  for (const m of list) {
    const painted = board.matches.get(m.matchId);
    matches.set(
      m.matchId,
      painted !== undefined && painted.version > m.version ? painted : m,
    );
  }
  return {
    ...board,
    matches,
    days: xornadaDays([...matches.values()], now),
  };
}
