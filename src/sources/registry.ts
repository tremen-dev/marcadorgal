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

export const SOURCES: readonly SourceConfig[] = SourceConfig.array().parse([
  {
    id: "api-football",
    kind: "pull",
    competitions: FIVE,
    priority: Object.fromEntries(FIVE.map((c) => [c, 10])),
    minIntervalSeconds: 30,
    userAgent: "marcador.gal (ingesta; https://marcador.gal)",
    legalBasis:
      "Plan Pro de API-Football contratado el 2026-09-21 por el titular; uso conforme a los términos del proveedor; gestión fuera del repo (D-7).",
  },
]);

export function sourceConfig(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
