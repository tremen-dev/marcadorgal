import { describe, expect, it } from "vitest";
import { decodeCell, unpackNtype } from "./decode.ts";
import { fixtureText } from "./fixture-files.ts";
import { readPanel } from "./panel.ts";

// SPEC-031 CA-2: one case per technique, with cells copied verbatim from the
// fixtures, and the ntype table taken from the script of that same response.

const MASCULINO = fixtureText("paneles-masculino");
const packedScript = (html: string): string => {
  const m = html.match(/<script>(eval\(function\(p,a,c,k,e,d\).*?)<\/script>/);
  if (!m) throw new Error("no packed script in the fixture");
  return m[1];
};
const table = unpackNtype(packedScript(MASCULINO));

describe("CA-2 unpackNtype", () => {
  it("reads the 40-digit table out of the packed function, without eval", () => {
    expect(table).toEqual([
      2, 5, 9, 4, 1, 0, 8, 6, 3, 7, 1, 3, 5, 7, 9, 0, 2, 4, 6, 8, 0, 2, 4, 6, 8,
      1, 3, 5, 7, 9, 7, 5, 2, 0, 9, 6, 3, 8, 4, 1,
    ]);
  });
});

describe("CA-2 decodeCell, one case per technique (real cells)", () => {
  it("plain text", () => {
    // paneles-masculino-fed3 21:25:36Z
    const cell =
      " <span class=parpadea> <i class=fa-solid>1</i> - <i class=fa-solid>1</i> </span> ";
    expect(decodeCell(cell, { table: null })).toMatchObject({
      visible: "1-1",
      score: { home: 1, away: 1 },
      blinking: true,
    });
  });

  it('ntype("idh1286541",8,0,"fa-5") is 3, never the decoy 5', () => {
    // paneles-masculino: FC Barcelona - Getafe CF
    const cell =
      ' <i class=fa-solid><i id=idh1286541 style="font-style:normal" class=fa-5><script>ntype("idh1286541",8,0,"fa-5");</script><span style="display:none;">5</span></i></i> - <i class=fa-solid>0</i> ';
    expect(decodeCell(cell, { table })).toMatchObject({
      visible: "3-0",
      score: { home: 3, away: 0 },
      blinking: false,
    });
  });

  it('::after{content:"1"} with the decoy 3 hidden', () => {
    // paneles-masculino: Deportivo Alavés - Club Atlético de Madrid. The
    // packed definition sits inside this cell, between the two sides.
    const cell = ` <i class=fa-solid><style>#idh1286539:after{content:"1"}</style><span id=idh1286539><span style="display:none;">3</span></span></i> - <script>${packedScript(MASCULINO)}</script><i class=fa-solid><i id=idh1286540 style="font-style:normal" class=fa-3><script>ntype("idh1286540",0,0,"fa-3");</script><span style="display:none;">3</span></i></i> `;
    const ctx = { table: null };
    expect(decodeCell(cell, ctx)).toMatchObject({
      visible: "1-2",
      score: { home: 1, away: 2 },
    });
  });

  it('::before{content:"\\0031"}', () => {
    // paneles-masculino-fed3 21:25:36Z: c.d. conxo santiago - r.c. deportivo "B"
    const cell =
      ' <i class=fa-solid>2</i> - <i class=fa-solid><style>#idh1395246:before{content:"\\0031"}</style><span id=idh1395246><span style="display:none;">4</span></span></i> ';
    expect(decodeCell(cell, { table: null })).toMatchObject({
      visible: "2-1",
      score: { home: 2, away: 1 },
    });
  });

  it('::before{content:"\\0030";display:none} + text 0 is 0', () => {
    // paneles-fed3-enjuego 21:33:30Z: Real Madrid CF - Villarreal CF
    const html = fixtureText("paneles-fed3-enjuego-2026-10-10T21-33-30Z");
    const cell = ` <span class=parpadea> <i class=fa-solid><style>#idh1419969:before{content:"\\0030";display:none}</style><span id=idh1419969>0<span style="display:none;">3</span></span></i> - <script>${packedScript(html)}</script><i class=fa-solid><i id=idh1419970 style="font-style:normal" class=fa-4><script>ntype("idh1419970",5,0,"fa-4");</script><span style="display:none;">4</span></i></i> </span> `;
    expect(decodeCell(cell, { table: null })).toMatchObject({
      visible: "0-0",
      score: { home: 0, away: 0 },
      blinking: true,
    });
  });

  it("an empty score is '-' and reads no score", () => {
    expect(
      decodeCell(" &nbsp;&nbsp;-&nbsp;&nbsp ", { table: null }),
    ).toMatchObject({ visible: "-", score: null, status: null });
  });

  it("«Suspendido» is a status, with no score", () => {
    expect(
      decodeCell(" <span class=aplazado>Suspendido</span> ", { table: null }),
    ).toMatchObject({
      visible: "Suspendido",
      score: null,
      status: "Suspendido",
    });
  });
});

describe("CA-2 the table comes from the response, never from the code", () => {
  it("changing the fixture's table changes the output with it", () => {
    const original = table.join(",");
    const reversed = table.toReversed();
    const mutated = MASCULINO.replace(original, reversed.join(","));
    expect(mutated).not.toBe(MASCULINO);
    const row = (html: string) =>
      readPanel(html).rows.find(
        (r) => r.home === "FC Barcelona" && r.away === "Getafe CF",
      );
    expect(row(MASCULINO)?.cell.score).toEqual({ home: 3, away: 0 });
    expect(row(mutated)?.cell.score).toEqual({ home: reversed[8], away: 0 });
  });
});
