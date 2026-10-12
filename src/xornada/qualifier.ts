import type { Qualifier } from "@/model";

// SPEC-034 CA-1: how the public screen presents `provisional`. Presentation
// only: the Decision's qualifier is never changed. The mode is chosen in the
// web's configuration (CA-5), never here.
export const PROVISIONAL_DISPLAYS = ["label", "mark", "hidden"] as const;
export type ProvisionalDisplay = (typeof PROVISIONAL_DISPLAYS)[number];

export type QualifierKey = `qualifier.${Exclude<Qualifier, "confirmado">}`;

// `label`: the word next to the margin (SPEC-019 CA-3). `mark`: the glyph
// `*`, the word for screen readers and the legend at the foot (CA-3).
// `none`: nothing painted.
export type QualifierDisplay =
  | { kind: "none" }
  | { kind: "label"; key: QualifierKey }
  | { kind: "mark"; key: "qualifier.provisional" };

// confirmado is never painted; sen_sinal always keeps its label (D-9).
export function qualifierDisplay(
  qualifier: Qualifier,
  mode: ProvisionalDisplay,
): QualifierDisplay {
  if (qualifier === "confirmado") return { kind: "none" };
  if (qualifier === "sen_sinal")
    return { kind: "label", key: "qualifier.sen_sinal" };
  if (mode === "mark") return { kind: "mark", key: "qualifier.provisional" };
  if (mode === "hidden") return { kind: "none" };
  return { kind: "label", key: "qualifier.provisional" };
}

// CA-3: the legend shows only in `mark`, and only over rows of which one is
// provisional (the served rows without JS; the visible ones with JS).
export function provisionalLegendShown(
  mode: ProvisionalDisplay,
  qualifiers: Iterable<Qualifier | string>,
): boolean {
  if (mode !== "mark") return false;
  for (const q of qualifiers) if (q === "provisional") return true;
  return false;
}
