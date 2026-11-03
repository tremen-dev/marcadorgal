// SPEC-045 CA-3 (H-1): a long competition name («Primeira Federación ·
// Grupo 1») breaks only before « · », never inside a segment, so «· Grupo 1»
// never leaves its number alone on another line. The segments, joined by the
// space each « · » sits after, are the canonical name (D-2): nothing is cut.
const SEPARATOR = " · ";

export function competitionNameSegments(name: string): string[] {
  const [first, ...rest] = name.split(SEPARATOR);
  return [first, ...rest.map((segment) => `· ${segment}`)];
}
