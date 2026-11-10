import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DayMatchesResponse } from "../lib/explorer-client.ts";
import type { ExplorerRow } from "../lib/explorer-identity.ts";
import { AliasFile, CompetitionId, TeamId } from "../model/index.ts";
import { realKickoffDays, realKickoffs } from "./real-kickoffs.ts";
import type { CalendarFile } from "./schema.ts";

// SPEC-071 CA-5 (ADR-031 §1): the real kickoff of a declared match already
// played is <day of the row> <horaTexto> in Europe/Madrid, from the only
// FINISHED row that pairs it in the window. Pure: calendar, alias, now and
// the export by day come in; nothing is read from the clock or the network.

const aliases = AliasFile.parse(
  JSON.parse(
    readFileSync(
      path.resolve(__dirname, "../../data/alias/2026-27/rfef.json"),
      "utf8",
    ),
  ),
);
const export1031 = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../sources/rfef/fixtures/export/export-2026-10-31-celta-fortuna-cordoba.json",
    ),
    "utf8",
  ),
) as DayMatchesResponse;
const celtaRow = export1031.matches.find(
  (r) => r.codActa === "70695028",
) as ExplorerRow;

// Tercera J8, from the real export of ?date=2026-10-24 (2026-11-10).
const celtigaRow: ExplorerRow = {
  codActa: "1428016",
  codGrupo: "26991073",
  horaTexto: "17:00",
  equipoLocal: "CELTIGA F.C.",
  equipoVisitante: "U.D. SOMOZAS",
  golesLocal: 1,
  golesVisitante: 1,
  estado: "FINISHED",
  canonicalCompetitionId: "tercera-rfef-g1",
  canonicalHomeTeamId: "celtiga-f-c",
  canonicalAwayTeamId: "u-d-somozas",
};

type Declared = { round: number; kickoff: string; home: string; away: string };
const calendarOf = (
  id: string,
  name: string,
  tier: 2 | 5,
  matches: Declared[],
): CalendarFile => ({
  competition: { id: CompetitionId.parse(id), season: "2026-27", name, tier },
  teams: [],
  matches: matches.map((m) => ({
    ...m,
    home: TeamId.parse(m.home),
    away: TeamId.parse(m.away),
  })),
});
const segunda = (matches: Declared[]) =>
  calendarOf("segunda-division", "Segunda División", 2, matches);
const celtaCordoba = {
  round: 12,
  kickoff: "2026-11-01T16:00:00Z",
  home: "celta-fortuna",
  away: "cordoba",
};
const CELTA_ID = "segunda-division-2026-27-j12-celta-fortuna-cordoba";
const NOW = "2026-11-10T12:00:00Z";
const rows = (entries: [string, ExplorerRow[]][]) => new Map(entries);

describe("SPEC-071 CA-5 realKickoffs", () => {
  it("Celta Fortuna–Córdoba, declared 11-01 16:00Z, was played 10-31 18:30 Madrid: 17:30Z", () => {
    const r = realKickoffs({
      calendar: segunda([celtaCordoba]),
      aliases,
      now: NOW,
      rowsByDay: rows([["2026-10-31", export1031.matches]]),
    });
    expect(r.corrections).toEqual([
      {
        id: CELTA_ID,
        from: "2026-11-01T16:00:00Z",
        to: "2026-10-31T17:30:00Z",
      },
    ]);
    expect(r.ambiguous).toEqual([]);
  });

  it("Tercera J8 Céltiga–Somozas, declared 10-25, was played 10-24 17:00 Madrid (CEST): 15:00Z", () => {
    const r = realKickoffs({
      calendar: calendarOf("tercera-rfef-g1", "Tercera RFEF Grupo 1", 5, [
        {
          round: 8,
          kickoff: "2026-10-25T17:00:00Z",
          home: "celtiga",
          away: "somozas",
        },
      ]),
      aliases,
      now: NOW,
      rowsByDay: rows([["2026-10-24", [celtigaRow]]]),
    });
    expect(r.corrections).toEqual([
      {
        id: "tercera-rfef-g1-2026-27-j8-celtiga-somozas",
        from: "2026-10-25T17:00:00Z",
        to: "2026-10-24T15:00:00Z",
      },
    ]);
  });

  it("horaTexto is copied as is: 17:33 is 17:33", () => {
    const r = realKickoffs({
      calendar: segunda([celtaCordoba]),
      aliases,
      now: NOW,
      rowsByDay: rows([["2026-10-31", [{ ...celtaRow, horaTexto: "17:33" }]]]),
    });
    expect(r.corrections.map((c) => c.to)).toEqual(["2026-10-31T16:33:00Z"]);
  });

  it("no change: a row not FINISHED, a horaTexto absent or invalid, the same instant, a kickoff ≥ now", () => {
    const one = (row: ExplorerRow, now = NOW, kickoff = celtaCordoba.kickoff) =>
      realKickoffs({
        calendar: segunda([{ ...celtaCordoba, kickoff }]),
        aliases,
        now,
        rowsByDay: rows([["2026-10-31", [row]]]),
      }).corrections;
    expect(one({ ...celtaRow, estado: "POSTPONED" })).toEqual([]);
    expect(one({ ...celtaRow, estado: "SUSPENDED" })).toEqual([]);
    expect(one({ ...celtaRow, horaTexto: undefined })).toEqual([]);
    expect(one({ ...celtaRow, horaTexto: "a determinar" })).toEqual([]);
    expect(one(celtaRow, NOW, "2026-10-31T17:30:00Z")).toEqual([]);
    expect(one(celtaRow, "2026-11-01T16:00:00Z")).toEqual([]);
    expect(one(celtaRow, "2026-11-01T15:00:00Z")).toEqual([]);
  });

  it("an ambiguous pairing changes nothing and is listed", () => {
    const r = realKickoffs({
      calendar: segunda([celtaCordoba]),
      aliases,
      now: NOW,
      rowsByDay: rows([
        ["2026-10-31", [celtaRow]],
        ["2026-11-02", [{ ...celtaRow, codActa: "99" }]],
      ]),
    });
    expect(r.corrections).toEqual([]);
    expect(
      r.ambiguous.map((a) => [a.id, a.candidates.map((c) => c.codActa)]),
    ).toEqual([[CELTA_ID, ["70695028", "99"]]]);
  });

  it("a POSTPONED and a FINISHED: the FINISHED corrects", () => {
    const r = realKickoffs({
      calendar: segunda([celtaCordoba]),
      aliases,
      now: NOW,
      rowsByDay: rows([
        ["2026-11-01", [{ ...celtaRow, codActa: null, estado: "POSTPONED" }]],
        ["2026-10-31", [celtaRow]],
      ]),
    });
    expect(r.corrections.map((c) => c.to)).toEqual(["2026-10-31T17:30:00Z"]);
  });

  it("since: only the kickoffs in [since, now)", () => {
    const input = {
      calendar: segunda([celtaCordoba]),
      aliases,
      now: NOW,
      rowsByDay: rows([["2026-10-31", export1031.matches]]),
    };
    expect(
      realKickoffs({ ...input, since: "2026-11-01T16:00:01Z" }).corrections,
    ).toEqual([]);
    expect(
      realKickoffs({ ...input, since: "2026-11-01T16:00:00Z" }).corrections,
    ).toHaveLength(1);
  });

  it("realKickoffDays: the window days of the matches in [since, now), each once", () => {
    const days = realKickoffDays(
      segunda([
        celtaCordoba,
        { ...celtaCordoba, home: "eibar", kickoff: "2026-11-02T20:00:00Z" },
        { ...celtaCordoba, home: "oviedo", kickoff: "2026-11-20T20:00:00Z" },
        { ...celtaCordoba, home: "leganes", kickoff: "2026-10-01T20:00:00Z" },
      ]),
      NOW,
      "2026-10-30T00:00:00Z",
    );
    expect(days).toEqual([
      "2026-10-29",
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
