import { describe, expect, it } from "vitest";
import type { ExplorerRow } from "./explorer-identity.ts";
import {
  madridKickoff,
  pickRowInWindow,
  windowDays,
} from "./explorer-window.ts";

// The common rule of SPEC-071 («ventana»): the candidates of a local match
// are the rows of the Madrid days [kickoff day − 3, + 3] that pass the
// identity; one pairs, several pair only if exactly one is FINISHED or,
// failing that, exactly one is on the kickoff day and hour.

const row = (
  over: Partial<ExplorerRow> & { codActa: string },
): ExplorerRow => ({
  codGrupo: "33836087",
  equipoLocal: "RC Celta Fortuna",
  equipoVisitante: "Córdoba CF",
  horaTexto: "18:30",
  estado: "FINISHED",
  golesLocal: 2,
  golesVisitante: 2,
  ...over,
});

const same = (r: ExplorerRow) =>
  r.equipoLocal === "RC Celta Fortuna" && r.equipoVisitante === "Córdoba CF";

describe("SPEC-071 windowDays", () => {
  it("the Madrid day of the kickoff ± 3, in order", () => {
    // 2026-11-01T23:30Z is already 11-02 in Madrid (CET).
    expect(windowDays("2026-11-01T23:30:00Z")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
  });
});

describe("SPEC-071 madridKickoff", () => {
  it("date + horaTexto in Europe/Madrid, to UTC with Z (CET and CEST)", () => {
    expect(madridKickoff("2026-10-31", "18:30")).toBe("2026-10-31T17:30:00Z");
    expect(madridKickoff("2026-10-24", "17:00")).toBe("2026-10-24T15:00:00Z");
    expect(madridKickoff("2026-11-07", "17:33")).toBe("2026-11-07T16:33:00Z");
  });

  it("an absent or invalid horaTexto gives nothing", () => {
    expect(madridKickoff("2026-10-31", undefined)).toBeNull();
    expect(madridKickoff("2026-10-31", "")).toBeNull();
    expect(madridKickoff("2026-10-31", "18.30")).toBeNull();
    expect(madridKickoff("2026-10-31", "8:30")).toBeNull();
    expect(madridKickoff("2026-10-31", "24:00")).toBeNull();
    expect(madridKickoff("2026-10-31", "18:60")).toBeNull();
  });
});

describe("SPEC-071 pickRowInWindow", () => {
  const kickoff = "2026-11-01T16:00:00Z";

  it("one candidate on another day of the window pairs, with its day", () => {
    const rows = new Map([
      ["2026-10-31", [row({ codActa: "70695028" })]],
      ["2026-11-01", [row({ codActa: "9", equipoLocal: "Otro" })]],
    ]);
    const p = pickRowInWindow(rows, same, kickoff);
    expect(p.kind).toBe("paired");
    if (p.kind !== "paired") return;
    expect(p.row.codActa).toBe("70695028");
    expect(p.date).toBe("2026-10-31");
  });

  it("days outside ±3 are never read", () => {
    const rows = new Map([
      ["2026-10-28", [row({ codActa: "1" })]],
      ["2026-11-05", [row({ codActa: "2" })]],
    ]);
    expect(pickRowInWindow(rows, same, kickoff).kind).toBe("unpaired");
  });

  it("several candidates, exactly one FINISHED: that one", () => {
    const rows = new Map([
      [
        "2026-10-30",
        [
          row({
            codActa: "p",
            estado: "POSTPONED",
            golesLocal: null,
            golesVisitante: null,
          }),
        ],
      ],
      ["2026-11-03", [row({ codActa: "f" })]],
    ]);
    const p = pickRowInWindow(rows, same, kickoff);
    expect(p.kind === "paired" && p.row.codActa).toBe("f");
  });

  it("two FINISHED off the kickoff day and hour: ambiguous", () => {
    const rows = new Map([
      ["2026-10-31", [row({ codActa: "a" })]],
      ["2026-11-02", [row({ codActa: "b" })]],
    ]);
    const p = pickRowInWindow(rows, same, kickoff);
    expect(p.kind).toBe("ambiguous");
    if (p.kind !== "ambiguous") return;
    expect(p.candidates.map((c) => [c.date, c.row.codActa])).toEqual([
      ["2026-10-31", "a"],
      ["2026-11-02", "b"],
    ]);
  });

  it("no single FINISHED: the tie-break needs the kickoff day and its hour", () => {
    // 16:00Z is 17:00 in Madrid on 11-01.
    const onDay = new Map([
      [
        "2026-11-01",
        [row({ codActa: "a", horaTexto: "17:00" }), row({ codActa: "b" })],
      ],
    ]);
    const p = pickRowInWindow(onDay, same, kickoff);
    expect(p.kind === "paired" && p.row.codActa).toBe("a");

    // Same hour, another day: not enough.
    const otherDay = new Map([
      ["2026-10-31", [row({ codActa: "a", horaTexto: "17:00" })]],
      ["2026-11-02", [row({ codActa: "b", horaTexto: "17:00" })]],
    ]);
    expect(pickRowInWindow(otherDay, same, kickoff).kind).toBe("ambiguous");
  });
});
