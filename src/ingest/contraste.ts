import type {
  AliasFile,
  ParseResult,
  RawCapture,
  SourceAdapter,
} from "../model/index.ts";
import type { ContrasteFila } from "./informe.ts";

// SPEC-009 CA-5. The only request that is not the tick's: one round of `ids=`
// when the matchday is over and outside every window (RN-08), counted apart.
// The capture arrives from an injected builder so this module stays free of
// the provider's base url, key header and page size —those live inside
// src/sources/api-football/— and the comparison itself is not here either:
// that is pure arithmetic and lives in informe.ts.

export type CapturaPorIds = (
  fixtureIds: readonly string[],
) => Promise<RawCapture>;

export type ContrasteOptions = {
  // The matches of the matchday, as the report already knows them.
  matches: readonly { id: string }[];
  aliases: AliasFile;
  adapter: SourceAdapter;
  capturar: CapturaPorIds;
};

export type ContrasteSalida = {
  filas: ContrasteFila[];
  // Requests the contrast itself made, to be noted apart from the tick's.
  peticiones: number;
  // Matches with no fixture id in the alias file: never asked, never silent.
  sinAlias: string[];
};

export async function contrastarMarcadores({
  matches,
  aliases,
  adapter,
  capturar,
}: ContrasteOptions): Promise<ContrasteSalida> {
  const fixtureIdByMatchId = new Map<string, string>(
    Object.entries(aliases.matches ?? {}).map(([ext, id]) => [id, ext]),
  );
  const sinAlias: string[] = [];
  const fixtureIds: string[] = [];
  for (const m of matches) {
    const fixtureId = fixtureIdByMatchId.get(m.id);
    if (fixtureId === undefined) sinAlias.push(m.id);
    else fixtureIds.push(fixtureId);
  }
  if (fixtureIds.length === 0)
    return {
      filas: matches.map((m) => ({ matchId: m.id, proveedor: null })),
      peticiones: 0,
      sinAlias,
    };

  const capture = await capturar(fixtureIds);
  // The adapter's own parse, over the capture: the alias resolution and the
  // status mapping are its job, not the report's.
  const parsed: ParseResult = adapter.parse(capture);
  const porPartido = new Map<string, ParseResult["observations"][number]>(
    parsed.observations.map((o) => [o.matchId, o]),
  );

  return {
    // One row per match asked, in the order the report has them: a match the
    // provider did not answer for comes back with proveedor null, which the
    // report prints as a discrepancy and never as a match.
    filas: matches.map((m) => {
      const o = porPartido.get(m.id);
      return {
        matchId: m.id,
        proveedor:
          o === undefined ? null : { status: o.status, score: o.score },
      };
    }),
    peticiones: capture.requests.length,
    sinAlias,
  };
}
