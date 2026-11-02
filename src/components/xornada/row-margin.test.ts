import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import { type MatchStatus, PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { CompetitionSection } from "./CompetitionSection";
import { MatchRow } from "./MatchRow";

// SPEC-040 CA-2 (H-1, H-4): no day header; every row says its date and time
// in a margin of two lines, as the server sends it.

const LOCALES = [
  ["gl", gl],
  ["es", es],
] as const;

type Live = { minute?: number | null; added?: number | null; ht?: boolean };

// 16:00Z on Saturday 3 October is 18:00 in Madrid.
function match(id: string, status: MatchStatus, live: Live = {}): PublicMatch {
  const scored =
    status === "live" || status === "finished" || status === "suspended";
  return PublicMatch.parse({
    matchId: id,
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 8,
    kickoff: "2026-10-03T16:00:00Z",
    home: { name: "RC Celta", shortName: "Celta" },
    away: { name: "Real Madrid", shortName: null },
    status,
    score: scored ? { home: 1, away: 0 } : null,
    minute:
      status === "live" ? (live.minute === undefined ? 30 : live.minute) : null,
    ...(status === "live"
      ? { addedMinute: live.added ?? null, halfTime: live.ht ?? false }
      : {}),
    qualifier: "confirmado",
    version: 3,
    observedAt: "2026-10-03T16:30:00Z",
    decidedAt: "2026-10-03T16:30:02Z",
  });
}

function rowHtml(locale: "gl" | "es", m: PublicMatch, today = false): string {
  const [competition] = buildXornada([m]);
  return renderToStaticMarkup(
    createElement("ul", null, [
      createElement(MatchRow, {
        key: "r",
        row: competition.rows[0],
        locale,
        today,
      }),
    ]),
  );
}

const DOT = 'aria-hidden="true"></span>';
const line = (html: string, testid: string): string | null => {
  const open = new RegExp(`<span[^>]*data-testid="${testid}"[^>]*>`).exec(html);
  if (!open) return null;
  // The content up to the span that closes this one.
  let depth = 1;
  let i = open.index + open[0].length;
  const start = i;
  const tag = /<(\/?)span\b[^>]*>/g;
  tag.lastIndex = i;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
    i = tag.lastIndex;
  }
  return null;
};
const text = (html: string | null): string =>
  (html ?? "").replace(/<[^>]*>/g, "").replaceAll("&#x27;", "'");

for (const [locale, dict] of LOCALES) {
  const month = locale === "gl" ? "out" : "oct";

  describe(`SPEC-040 CA-2 the margin of a row (${locale})`, () => {
    it("scheduled: the time, and below it the date", () => {
      const html = rowHtml(locale, match("a", "scheduled"));
      expect(text(line(html, "match-margin"))).toBe("18:00");
      expect(text(line(html, "match-margin-sub"))).toBe(`sáb 3 ${month}`);
    });

    it("today's date in capitals", () => {
      const html = rowHtml(locale, match("a", "scheduled"), true);
      expect(text(line(html, "match-margin-sub"))).toBe(
        `SÁB 3 ${month.toUpperCase()}`,
      );
    });

    it.each(["finished", "postponed", "suspended"] as const)(
      "%s: the state word and the date, no time",
      (status) => {
        const html = rowHtml(locale, match("a", status));
        expect(text(line(html, "match-margin"))).toBe(dict.status[status]);
        expect(text(line(html, "match-margin-sub"))).toBe(`sáb 3 ${month}`);
        expect(html).not.toContain("18:00");
      },
    );

    it.each([
      [{ minute: 30 }, "30'", "1ª P", dict.xornada.firstPartLong],
      [{ minute: 45, added: 3 }, "45+3'", "1ª P", dict.xornada.firstPartLong],
      [{ minute: 46 }, "46'", "2ª P", dict.xornada.secondPartLong],
      [{ minute: 90, added: 2 }, "90+2'", "2ª P", dict.xornada.secondPartLong],
    ] as const)(
      "live %o: dot, minute and its part, no date",
      (live, minute, part, long) => {
        const html = rowHtml(locale, match("a", "live", live));
        const main = line(html, "match-margin") ?? "";
        expect(main).toContain(DOT);
        expect(text(main)).toBe(minute);
        const sub = line(html, "match-margin-sub") ?? "";
        expect(sub).toContain(`<span aria-hidden="true">${part}</span>`);
        expect(sub).toMatch(
          new RegExp(`<span class="[^"]*srOnly[^"]*">${long}</span>`),
        );
        expect(html).not.toContain(` 3 ${month}`);
      },
    );

    it("half-time: «En xogo» without dot, and «DESCANSO»", () => {
      const html = rowHtml(
        locale,
        match("a", "live", { minute: 45, ht: true }),
      );
      const main = line(html, "match-margin") ?? "";
      expect(main).not.toContain(DOT);
      expect(text(main)).toBe(dict.status.live);
      expect(text(line(html, "match-margin-sub"))).toBe(
        dict.xornada.halfTime.toLocaleUpperCase(locale),
      );
    });

    it("live without minute: «En xogo» with dot, the second line empty", () => {
      const html = rowHtml(locale, match("a", "live", { minute: null }));
      const main = line(html, "match-margin") ?? "";
      expect(main).toContain(DOT);
      expect(text(main)).toBe(dict.status.live);
      expect(line(html, "match-margin-sub")).toBe("");
    });
  });
}

describe("SPEC-040 CA-2 the competition, without day headers", () => {
  const matches = [
    match("sat", "finished"),
    PublicMatch.parse({
      ...match("sun", "scheduled"),
      kickoff: "2026-10-04T16:00:00Z",
    }),
  ];
  const [competition] = buildXornada(matches);
  const html = renderToStaticMarkup(
    createElement(CompetitionSection, {
      competition,
      locale: "gl",
      days: xornadaDays(matches, "2026-10-04T10:00:00Z"),
    }),
  );

  it("one <ul>, no <h3>, no day group", () => {
    expect(html.match(/<ul\b/g)).toHaveLength(1);
    expect(html).not.toContain("<h3");
    expect(html).not.toContain("data-day-group");
    expect(html).not.toContain("day-header");
  });

  it("today is said by the row's date, in capitals", () => {
    expect(html).toContain("sáb 3 out");
    expect(html).toContain("DOM 4 OUT");
  });
});

describe("SPEC-040 CA-2 i18n", () => {
  it("has the parts in both languages", () => {
    expect([gl.xornada.firstPart, gl.xornada.secondPart]).toEqual([
      "1ª P",
      "2ª P",
    ]);
    expect([es.xornada.firstPart, es.xornada.secondPart]).toEqual([
      "1ª P",
      "2ª P",
    ]);
    expect(gl.xornada.firstPartLong).toBe("primeira parte");
    expect(es.xornada.firstPartLong).toBe("primera parte");
    expect(gl.xornada.secondPartLong).toBe("segunda parte");
    expect(es.xornada.secondPartLong).toBe("segunda parte");
  });
});
