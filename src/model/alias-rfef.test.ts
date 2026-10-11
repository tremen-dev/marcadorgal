import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AliasFile } from "./alias.ts";
import { RawCapture, SkippedReason } from "./source.ts";

// SPEC-031 CA-6, model part: codgrupo -> competition lives in an optional
// `competitions` map, and two new skipped reasons for the RFEF.
describe("SPEC-031 CA-6 model", () => {
  it("AliasFile accepts an optional competitions map", () => {
    const file = {
      source: "rfef",
      season: "2026-27",
      teams: [],
      competitions: { "26991073": "tercera-rfef-g1" },
    };
    expect(AliasFile.parse(file).competitions).toEqual({
      "26991073": "tercera-rfef-g1",
    });
    expect(() =>
      AliasFile.parse({ ...file, competitions: { "1": "Not A Slug" } }),
    ).toThrow();
  });

  it("api-football.json still validates", () => {
    const raw = readFileSync(
      new URL("../../data/alias/2026-27/api-football.json", import.meta.url),
      "utf8",
    );
    expect(() => AliasFile.parse(JSON.parse(raw))).not.toThrow();
  });

  it("SkippedReason gains ambiguous_state and suspended_without_score", () => {
    expect(SkippedReason.parse("ambiguous_state")).toBe("ambiguous_state");
    expect(SkippedReason.parse("suspended_without_score")).toBe(
      "suspended_without_score",
    );
  });

  it("RawRequest gains optional method and requestBody (E-1, ADR-018 §2)", () => {
    const old = {
      sourceId: "api-football",
      capturedAt: "2026-09-21T12:42:48Z",
      requests: [
        {
          url: "https://v3.football.api-sports.io/fixtures?ids=1",
          status: 200,
          contentType: "application/json",
          body: "{}",
        },
      ],
    };
    // A capture serialized before the change still validates, untouched.
    expect(RawCapture.parse(JSON.parse(JSON.stringify(old)))).toEqual(old);
    const post = {
      ...old,
      sourceId: "rfef",
      requests: [
        {
          url: "https://marcadores.rfef.es/pnfg/NPcd/NFG_CMP_Paneles",
          method: "POST",
          requestBody: "cod_primaria=3001668&federacion=3",
          status: 200,
          contentType: "text/html;charset=ISO-8859-15",
          body: "",
        },
      ],
    };
    expect(RawCapture.parse(post).requests[0]).toMatchObject({
      method: "POST",
      requestBody: "cod_primaria=3001668&federacion=3",
    });
    expect(() =>
      RawCapture.parse({
        ...post,
        requests: [{ ...post.requests[0], method: "PUT" }],
      }),
    ).toThrow();
  });
});
