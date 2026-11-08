import { FEDERATION_PRIORITY, SourceConfig } from "../model/index.ts";

// Registry of sources (ADR-003, D-7, RN-08, ADR-026): configuration validated
// at import time. No adapter is imported here (N-5): the id -> instance table is
// the core's. Priority 10 for API-Football (now deprecated/backup);
// rfef elevated to priority 50 as official federation source (ADR-017 §5 restored,
// ADR-026); operator 100 (N-4). The 30 s cadence is the tick cadence (ADR-002).
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
  // The rfef via explorer (ADR-023, ADR-026, SPEC-038, SPEC-049, SPEC-062): priority 50
  // as the official federative source (ADR-017 §5 restored, superseding priority 5).
  // Multi-provider arbitration in explorer v2.0 (MARCA for Primera and Segunda,
  // RFEF for 1ª/2ª/3ª RFEF) lifts the temporary liveObservedOnly restriction of ADR-027 §3.
  {
    id: "rfef",
    kind: "pull",
    competitions: FIVE,
    priority: Object.fromEntries(FIVE.map((c) => [c, FEDERATION_PRIORITY])),
    minIntervalSeconds: 30,
    userAgent: USER_AGENT,
    legalBasis:
      "Datos de rfef.es y proveedores multi-fuente vía explorer (ADR-026)",
  },
]);

export function sourceConfig(id: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.id === id);
}
