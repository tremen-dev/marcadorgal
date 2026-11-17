import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { t } from "@/i18n";
import { PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { MatchRow } from "./MatchRow";

// SPEC-091 CA-5/CA-6: a scheduled match whose kickoff is only the round or
// only the date says so; never «01:00» off the nominal 00:00Z.

const NOMINAL = "2026-11-29T00:00:00Z"; // 01:00 in Madrid, a sunday

function match(
  id: string,
  precision: "date" | "round" | undefined,
  kickoff = NOMINAL,
): PublicMatch {
  return PublicMatch.parse({
    matchId: id,
    competitionId: "segunda-federacion-fem-g1",
    competitionName: "2ª Federación Feminina G1",
    tier: 4,
    round: 11,
    kickoff,
    ...(precision === undefined ? {} : { kickoffPrecision: precision }),
    home: { name: "Deportivo ABANCA B", shortName: "Depor ABANCA B" },
    away: { name: "Victoria CF", shortName: "Victoria" },
    status: "scheduled",
    score: null,
    minute: null,
    qualifier: "confirmado",
    version: 0,
    observedAt: null,
    decidedAt: null,
    homeScoredAt: null,
    awayScoredAt: null,
  });
}

function rowHtml(locale: "gl" | "es", m: PublicMatch): string {
  const [competition] = buildXornada([m]);
  return renderToStaticMarkup(
    createElement("ul", null, [
      createElement(MatchRow, {
        key: "r",
        row: competition.rows[0],
        locale,
      }),
    ]),
  );
}

const text = (html: string, testid: string): string => {
  const m = new RegExp(
    `<span[^>]*data-testid="${testid}"[^>]*>(.*?)</span>`,
  ).exec(html);
  return (m?.[1] ?? "").replace(/<[^>]+>/g, "");
};

describe("SPEC-091 CA-5 round precision", () => {
  it.each([
    ["gl", "xornada 11"],
    ["es", "jornada 11"],
  ] as const)("%s: only «%s», no time, no date line", (locale, label) => {
    const html = rowHtml(locale, match("r", "round"));
    expect(text(html, "match-margin")).toBe(label);
    expect(text(html, "match-margin-sub")).toBe("");
    expect(html).not.toContain("01:00");
  });

  it("its nominal date does not enter xornadaDays", () => {
    const days = xornadaDays(
      [match("r", "round"), match("e", undefined, "2026-11-28T15:00:00Z")],
      "2026-11-27T10:00:00Z",
    );
    expect(days.map((d) => d.date)).toEqual(["2026-11-28"]);
  });
});

describe("SPEC-091 CA-6 date precision", () => {
  it.each(["gl", "es"] as const)(
    "%s: the date line and xornada.timeTbd instead of the time",
    (locale) => {
      const html = rowHtml(locale, match("d", "date"));
      expect(text(html, "match-margin")).toBe(t(locale, "xornada.timeTbd"));
      expect(text(html, "match-margin-sub")).not.toBe("");
      expect(html).not.toContain("01:00");
    },
  );

  it("the texts are the approved ones", () => {
    expect(t("gl", "xornada.timeTbd")).toBe("Hora por confirmar");
    expect(t("es", "xornada.timeTbd")).toBe("Hora por confirmar");
  });

  it("without precision the time is painted as always", () => {
    const html = rowHtml("gl", match("x", undefined, "2026-11-28T15:00:00Z"));
    expect(text(html, "match-margin")).toBe("16:00");
  });
});
