// SPEC-091 CA-3: how much of an explorer kickoff is real. A rule of the
// explorer calendar contract, not of a competition (nota 3): `dateConfirmed`
// absent means true; with false, the kickoff is the nominal date at 00:00Z
// and only orders, whatever timeConfirmed says.
export type KickoffPrecision = "exact" | "date" | "round";

export function kickoffPrecision(match: {
  timeConfirmed: boolean;
  dateConfirmed?: boolean;
}): KickoffPrecision {
  if (match.dateConfirmed === false) return "round";
  if (match.timeConfirmed === false) return "date";
  return "exact";
}
