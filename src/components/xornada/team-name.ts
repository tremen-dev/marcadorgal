import type { XornadaRow } from "@/xornada/view";

// How a team name is painted. SPEC-019: the winner in 600, the loser and a
// postponed match dimmed. SPEC-033 CA-5 (H-5): an Equipo galego in 600 and
// --marca; when it loses or its match is postponed, --marca-deep instead of
// the dim, so it never reads as a winner. A mark, not a state: no label.
export type TeamNameTone =
  | "plain"
  | "winner"
  | "loser"
  | "dim"
  | "galician"
  | "galicianDeep";

export function teamNameTone(
  row: Pick<XornadaRow, "status" | "winner" | "homeGalician" | "awayGalician">,
  side: "home" | "away",
): TeamNameTone {
  const galician = side === "home" ? row.homeGalician : row.awayGalician;
  const loses = row.winner !== null && row.winner !== side;
  const muted = loses || row.status === "postponed";
  if (galician) return muted ? "galicianDeep" : "galician";
  if (row.winner === side) return "winner";
  if (loses) return "loser";
  if (row.status === "postponed") return "dim";
  return "plain";
}
