import { describe, expect, it } from "vitest";
import type { Instant } from "../../model/index.ts";
import { fixtureText } from "./fixture-files.ts";
import { type PanelRow, readPanel } from "./panel.ts";
import { kickoffOf, rowState } from "./state.ts";

// SPEC-031 CA-5: one case per row of the table of ADR-017 §4, over real rows
// with a variable capturedAt. The kickoff is the row's, Europe/Madrid.

const FED3 = readPanel(
  fixtureText("paneles-masculino-fed3-2026-10-10T21-25-36Z"),
);
const row = (home: string): PanelRow => {
  const r = FED3.rows.find((x) => x.home === home);
  if (r === undefined) throw new Error(`no row ${home}`);
  return r;
};
const at = (ms: number) => new Date(ms).toISOString() as Instant;
const MIN = 60_000;

// Both kick off on SÁB 10-10 at 21:00h local, 19:00Z (CEST).
const KICKOFF = Date.UTC(2026, 9, 10, 19, 0);
const REAL_MADRID = row("Real Madrid CF"); // parpadea, no link, 0-0
const CELTA_FORTUNA = row("RC Celta Fortuna"); // no parpadea, no link, 4-1
const FABRIL = row("RC Deportivo Fabril"); // verPartido, 0-1
const RAYO = row("Rayo Vallecano de Madrid"); // «Suspendido», no score
const ELCHE = row("Elche CF"); // "-"

describe("CA-5 kickoff", () => {
  it("is the row's local time in Europe/Madrid, summer time", () => {
    expect(kickoffOf(REAL_MADRID, "2026-10-10T21:25:36Z" as Instant)).toBe(
      KICKOFF,
    );
  });

  it("is UTC+1 in winter time", () => {
    const winter = { ...REAL_MADRID, day: 15, month: 11 };
    expect(kickoffOf(winter, "2026-11-15T20:00:00Z" as Instant)).toBe(
      Date.UTC(2026, 10, 15, 20, 0),
    );
  });

  it("takes the year closest to capturedAt across New Year", () => {
    const row0201 = { ...REAL_MADRID, day: 2, month: 1 };
    expect(kickoffOf(row0201, "2026-12-31T22:00:00Z" as Instant)).toBe(
      Date.UTC(2027, 0, 2, 20, 0),
    );
    const row3112 = { ...REAL_MADRID, day: 31, month: 12 };
    expect(kickoffOf(row3112, "2027-01-02T10:00:00Z" as Instant)).toBe(
      Date.UTC(2026, 11, 31, 20, 0),
    );
  });
});

describe("CA-5 states (ADR-017 §4)", () => {
  it("a score and verPartido(acta) is finished, at any time", () => {
    expect(FABRIL.acta?.kind).toBe("closed");
    for (const t of [KICKOFF - 60 * MIN, KICKOFF + 5 * MIN])
      expect(rowState(FABRIL, at(t))).toEqual({
        status: "finished",
        score: { home: 0, away: 1 },
        minute: null,
      });
  });

  it("a score without parpadea is finished from kickoff + 100 min", () => {
    expect(CELTA_FORTUNA.cell.blinking).toBe(false);
    expect(CELTA_FORTUNA.acta).toBeNull();
    expect(rowState(CELTA_FORTUNA, at(KICKOFF + 99 * MIN))).toBe(
      "ambiguous_state",
    );
    expect(rowState(CELTA_FORTUNA, at(KICKOFF + 100 * MIN))).toEqual({
      status: "finished",
      score: { home: 4, away: 1 },
      minute: null,
    });
  });

  it("a score with parpadea is live in [kickoff - 10, kickoff + 110)", () => {
    expect(REAL_MADRID.cell.blinking).toBe(true);
    const live = {
      status: "live",
      score: { home: 0, away: 0 },
      minute: null,
      addedMinute: null,
    };
    expect(rowState(REAL_MADRID, at(KICKOFF - 11 * MIN))).toBe(
      "ambiguous_state",
    );
    expect(rowState(REAL_MADRID, at(KICKOFF - 10 * MIN))).toEqual(live);
    expect(rowState(REAL_MADRID, at(KICKOFF + 109 * MIN))).toEqual(live);
    expect(rowState(REAL_MADRID, at(KICKOFF + 110 * MIN))).toBe(
      "ambiguous_state",
    );
  });

  // The rule, not evidence: the sondeo was a GET and may have been a cache
  // (ADR-018, «Sobre ADR-017 §4»).
  it("parpadea at 21:47Z (kickoff + 167 min, the sondeo) is ambiguous", () => {
    const late = readPanel(
      fixtureText("paneles-fed3-enjuego-2026-10-10T21-47-34Z"),
    ).rows[0];
    expect(late.cell.blinking).toBe(true);
    expect(rowState(late, "2026-10-10T21:47:34Z" as Instant)).toBe(
      "ambiguous_state",
    );
  });

  it("«Suspendido» without a score is skipped until the engine spec", () => {
    expect(rowState(RAYO, at(KICKOFF))).toBe("suspended_without_score");
  });

  it("«Suspendido» with a score is suspended with that score", () => {
    // Derived from a real row: no capture has «Suspendido» with a score yet.
    const withScore = {
      ...FABRIL,
      acta: null,
      cell: { ...FABRIL.cell, status: "Suspendido", visible: "0-1Suspendido" },
    };
    expect(rowState(withScore, at(KICKOFF))).toEqual({
      status: "suspended",
      score: { home: 0, away: 1 },
      minute: null,
    });
  });

  it("«Aplazado» is postponed, and another text is unsupported", () => {
    // Derived from the real «Suspendido» row: no «Aplazado» in the sondeo.
    const aplazado = {
      ...RAYO,
      cell: { ...RAYO.cell, status: "Aplazado", visible: "Aplazado" },
    };
    expect(rowState(aplazado, at(KICKOFF))).toEqual({
      status: "postponed",
      score: null,
      minute: null,
    });
    const other = {
      ...RAYO,
      cell: { ...RAYO.cell, status: "Anulado", visible: "Anulado" },
    };
    expect(rowState(other, at(KICKOFF))).toBe("unsupported_status");
  });

  it("a '-' row has no state at all", () => {
    expect(ELCHE.cell.visible).toBe("-");
    expect(rowState(ELCHE, at(KICKOFF))).toBeNull();
  });

  it("never emits scheduled, for any real row at any time", () => {
    for (const r of FED3.rows)
      for (const d of [-600, -11, 0, 50, 105, 200])
        expect(rowState(r, at(KICKOFF + d * MIN))).not.toMatchObject({
          status: "scheduled",
        });
  });
});

// E-1: the evidence of the table comes from the POST series of 2026-10-11.
describe("CA-5 states over the POST series (ADR-018)", () => {
  const panel = (ts: string) =>
    readPanel(fixtureText(`campo-post-2026-10-11T${ts}Z-todos`));
  const find = (rows: PanelRow[], home: string) => {
    const r = rows.find((x) => x.home === home);
    if (r === undefined) throw new Error(`no row ${home}`);
    return r;
  };
  const AT_1500 = "2026-10-11T15:00:15Z" as Instant;
  const AT_1535 = "2026-10-11T15:35:05Z" as Instant;
  const live = (home: number, away: number) => ({
    status: "live",
    score: { home, away },
    minute: null,
    addedMinute: null,
  });

  it("Segunda Fed. at kickoff, with parpadea and no link yet, is live", () => {
    const coruxo = find(panel("15-00-15").rows, "Coruxo FC");
    expect(coruxo.cell.blinking).toBe(true);
    expect(coruxo.acta).toBeNull();
    expect(rowState(coruxo, AT_1500)).toEqual(live(0, 0));
  });

  it("Tercera at kickoff + 5 with parpadea is live", () => {
    const boiro = find(
      panel("15-35-05").rows.filter((r) => r.codgrupo === "26991073"),
      "c.d. boiro",
    );
    expect(rowState(boiro, AT_1535)).toEqual(live(0, 0));
  });

  it("Primera Fed. with verPartidoEnJuego and parpadea at kickoff + 65 is live, without a minute", () => {
    const pontevedra = find(panel("15-35-05").rows, "Pontevedra CF");
    expect(pontevedra.acta?.kind).toBe("open");
    expect(rowState(pontevedra, AT_1535)).toEqual(live(0, 1));
  });

  it("Tercera never shows an acta: finished by the clock (kickoff + 270)", () => {
    const montaneros = find(
      panel("15-00-15").rows,
      "atl. coruña montañeros c.f.",
    );
    expect(montaneros.acta).toBeNull();
    expect(montaneros.cell.blinking).toBe(false);
    expect(rowState(montaneros, AT_1500)).toEqual({
      status: "finished",
      score: { home: 3, away: 1 },
      minute: null,
    });
  });

  it("Segunda Fed. with verPartido is finished", () => {
    const vetusta = find(panel("15-00-15").rows, "Real Oviedo Vetusta");
    expect(vetusta.acta?.kind).toBe("closed");
    expect(rowState(vetusta, AT_1500)).toEqual({
      status: "finished",
      score: { home: 2, away: 1 },
      minute: null,
    });
  });

  it("no row of the five competitions is ambiguous in the POST fixtures", () => {
    const FIVE = ["33836085", "33836087", "33836089", "33836092", "26991073"];
    for (const [ts, at] of [
      ["15-00-15", AT_1500],
      ["15-02-24", "2026-10-11T15:02:24Z" as Instant],
      ["15-35-05", AT_1535],
    ] as const)
      for (const r of panel(ts).rows.filter((x) => FIVE.includes(x.codgrupo)))
        expect(rowState(r, at)).not.toBe("ambiguous_state");
  });
});
