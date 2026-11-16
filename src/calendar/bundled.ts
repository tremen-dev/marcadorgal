import primeraDivision2026 from "../../data/calendario/2026-27/primera-division.json" with {
  type: "json",
};
import primeraRfef2026 from "../../data/calendario/2026-27/primera-rfef-g1.json" with {
  type: "json",
};
import segundaDivision2026 from "../../data/calendario/2026-27/segunda-division.json" with {
  type: "json",
};
import segundaRfef2026 from "../../data/calendario/2026-27/segunda-rfef-g1.json" with {
  type: "json",
};
import terceraRfef2026 from "../../data/calendario/2026-27/tercera-rfef-g1.json" with {
  type: "json",
};

// SPEC-089 CA-2: the declared calendars bundled as JSON (no file reads at
// request time, as galicians.ts), by season and competition id. Unvalidated:
// the reader parses them with CalendarFile.
export const BUNDLED_CALENDARS: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  "2026-27": {
    "primera-division": primeraDivision2026,
    "segunda-division": segundaDivision2026,
    "primera-rfef-g1": primeraRfef2026,
    "segunda-rfef-g1": segundaRfef2026,
    "tercera-rfef-g1": terceraRfef2026,
  },
};
