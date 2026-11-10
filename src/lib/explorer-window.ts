import type { Instant } from "../model/index.ts";
import { madridDateOf } from "../sources/rfef/explorer.ts";
import { madridToUtc } from "../sources/rfef/state.ts";
import { type ExplorerRow, madridHour } from "./explorer-identity.ts";

// The window of SPEC-071 (ADR-031 §1): a match declared on one day may have
// been played another. The candidates of a local match are the rows of the
// export of the Madrid days [kickoff day − 3, + 3] that pass the identity of
// SPEC-070 (isSameMatch, unchanged). One pure function, shared by
// historico:sync and calendario:sync.

export const WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Rows of the export by the Madrid day they were asked for.
export type RowsByDay = ReadonlyMap<string, readonly ExplorerRow[]>;
export type DatedRow = { date: string; row: ExplorerRow };

export type WindowPairing =
  | { kind: "paired"; row: ExplorerRow; date: string }
  | { kind: "unpaired" }
  | { kind: "ambiguous"; candidates: DatedRow[] };

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function windowDaysOf(day: string): string[] {
  const days: string[] = [];
  for (let n = -WINDOW_DAYS; n <= WINDOW_DAYS; n += 1)
    days.push(addDays(day, n));
  return days;
}

// The Madrid days of the window of a kickoff, in order.
export function windowDays(kickoff: Instant): string[] {
  return windowDaysOf(madridDateOf(kickoff));
}

// Every row of the window, with the day it came from.
export function rowsInWindow(
  rowsByDay: RowsByDay,
  kickoff: Instant,
): DatedRow[] {
  return windowDays(kickoff).flatMap((date) =>
    (rowsByDay.get(date) ?? []).map((row) => ({ date, row })),
  );
}

// One candidate pairs. Several: exactly one FINISHED (postponed or suspended
// and replayed); else the tie-break of SPEC-070 CA-5 with the day and the
// horaTexto of the kickoff; else ambiguous. Never the first that fits.
export function pickRowInWindow(
  rowsByDay: RowsByDay,
  isSame: (row: ExplorerRow) => boolean,
  kickoff: Instant,
): WindowPairing {
  const candidates = rowsInWindow(rowsByDay, kickoff).filter((c) =>
    isSame(c.row),
  );
  const only = (list: DatedRow[]): WindowPairing | null => {
    const [one] = list;
    return list.length === 1 && one
      ? { kind: "paired", row: one.row, date: one.date }
      : null;
  };
  if (candidates.length === 0) return { kind: "unpaired" };
  const single = only(candidates);
  if (single) return single;
  const finished = only(candidates.filter((c) => c.row.estado === "FINISHED"));
  if (finished) return finished;
  const day = madridDateOf(kickoff);
  const hour = madridHour(kickoff);
  const onTime = only(
    candidates.filter((c) => c.date === day && c.row.horaTexto === hour),
  );
  return onTime ?? { kind: "ambiguous", candidates };
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

// <date> <horaTexto> in Europe/Madrid, as an instant in UTC with Z; null
// when horaTexto is absent or not HH:MM. Copied as is (ADR-031 §3): 17:33 is
// 17:33.
export function madridKickoff(
  date: string,
  horaTexto: string | undefined,
): Instant | null {
  const m = horaTexto === undefined ? null : HORA.exec(horaTexto);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m || !d) return null;
  const ms = madridToUtc(
    Number(d[1]),
    Number(d[2]),
    Number(d[3]),
    Number(m[1]),
    Number(m[2]),
  );
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}
