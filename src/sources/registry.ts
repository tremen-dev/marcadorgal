import { SourceConfig } from "../model/index.ts";

// Registry of sources (ADR-003, D-7, RN-08): configuration validated at
// import time. No adapter is imported here (N-5): the id -> instance table is
// the core's. Priority 10 for the provider leaves room below (backup
// aggregator: 5) and above (second provider: 20); federation 50, operator
// 100 (N-4). The 30 s cadence is the tick cadence (ADR-002).
const FIVE = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

// One identity for every request that leaves marcador.gal (ADR-021 §6,
// F-SPEC-032-4): the same UA src/sources/rfef/adapter.ts declares.
const USER_AGENT = "marcador.gal (ingesta; https://marcador.gal)";

export const SOURCES: readonly SourceConfig[] = SourceConfig.array().parse([
  {
    id: "api-football",
    kind: "pull",
    competitions: FIVE,
    priority: Object.fromEntries(FIVE.map((c) => [c, 10])),
    minIntervalSeconds: 30,
    userAgent: USER_AGENT,
    legalBasis:
      "Plan Pro de API-Football contratado el 2026-09-21 por el titular; uso conforme a los términos del proveedor; gestión fuera del repo (D-7).",
  },
  // The rfef via explorer (ADR-023 §1, §3; SPEC-038 CA-7): priority 5,
  // temporary, while the observation lasts (supersedes ADR-017 §5): with
  // RN-01 api-football rules while it speaks, the rfef confirms and covers
  // the silence. The cadence is against a service of our own; the one
  // against marcadores.rfef.es lives in explorer. legalBasis is the text
  // of the titular (H-3, D-7), annotated, never evaluated.
  {
    id: "rfef",
    kind: "pull",
    competitions: FIVE,
    priority: Object.fromEntries(FIVE.map((c) => [c, 5])),
    minIntervalSeconds: 30,
    userAgent: USER_AGENT,
    legalBasis: "Datos de rfef.es",
    // ADR-027 §3 (SPEC-048): the rfef panel does not seem to carry the live
    // of Primera and Segunda (0-0 frozen, 2026-11-02). Its live there is
    // stored, never decided; its finals still count. Reverting is deleting
    // this line, with the titular's decision in the ledger of SPEC-048.
    liveObservedOnly: ["primera-division", "segunda-division"],
  },
]);

export function sourceConfig(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
