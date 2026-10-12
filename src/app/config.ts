import type { ProvisionalDisplay } from "@/xornada/qualifier";

// The web's configuration: editorial choices of the public screen, versioned
// and tested. Changing one is one line and one PR.

// SPEC-034 CA-5 (H-1..H-4): how the screen presents a provisional Decision.
// "label" (the word), "mark" (the glyph * with a legend) or "hidden".
export const PROVISIONAL_DISPLAY: ProvisionalDisplay = "mark";
