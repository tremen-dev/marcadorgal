// SPEC-023: the day and status filter of the Xornada screen, pure. The state
// lives in the URL fragment (`#d=2026-10-11&f=live|finished`, H-5), so it is
// shareable and never touches the cache; the client applies it over the
// served HTML.

export const FILTERS = ["live", "finished"] as const;
export type XornadaFilter = (typeof FILTERS)[number];

export type XornadaState = {
  readonly day: string | null;
  readonly filter: XornadaFilter | null;
};

export const EMPTY_STATE: XornadaState = { day: null, filter: null };

const isFilter = (value: string | null): value is XornadaFilter =>
  (FILTERS as readonly (string | null)[]).includes(value);

// An invalid value, or a day that is not in the strip, is ignored on its own:
// whole xornada for the day, Todos for the filter (CA-4).
export function parseFragment(
  hash: string,
  days: readonly string[],
): XornadaState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const day = params.get("d");
  const filter = params.get("f");
  return {
    day: day !== null && days.includes(day) ? day : null,
    filter: isFilter(filter) ? filter : null,
  };
}

// "" for the empty state: the whole xornada with Todos has no fragment.
export function fragmentOf(state: XornadaState): string {
  const parts: string[] = [];
  if (state.day !== null) parts.push(`d=${state.day}`);
  if (state.filter !== null) parts.push(`f=${state.filter}`);
  return parts.length === 0 ? "" : `#${parts.join("&")}`;
}

// Choosing the selected day clears it (CA-2).
export function toggleDay(state: XornadaState, day: string): XornadaState {
  return { ...state, day: state.day === day ? null : day };
}

export function withFilter(
  state: XornadaState,
  filter: XornadaFilter | null,
): XornadaState {
  return { ...state, filter };
}

type FilterableRow = { readonly status: string; readonly day: string };

// En xogo is `live` (half-time and sen sinal included); Rematados `finished`.
export function rowMatches(row: FilterableRow, state: XornadaState): boolean {
  if (state.day !== null && row.day !== state.day) return false;
  if (state.filter !== null && row.status !== state.filter) return false;
  return true;
}

export type FilterCounts = { all: number; live: number; finished: number };

// The number of each pill, over the chosen day or the whole xornada (CA-3).
export function countFilters(
  rows: readonly FilterableRow[],
  day: string | null,
): FilterCounts {
  const counts: FilterCounts = { all: 0, live: 0, finished: 0 };
  for (const row of rows) {
    if (day !== null && row.day !== day) continue;
    counts.all += 1;
    if (row.status === "live") counts.live += 1;
    if (row.status === "finished") counts.finished += 1;
  }
  return counts;
}
