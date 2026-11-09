import { describe, expect, it } from "vitest";
import {
  ALLOWED_COMPETITIONS,
  CompetitionCode,
  getCompetitionMetadata,
  getCompetitionsByCategory,
  isAllowedCompetition,
} from "./competitions.ts";

describe("Women and Men Competitions Model", () => {
  it("includes all 8 permitted competitions including the 3 women football ones", () => {
    expect(ALLOWED_COMPETITIONS).toContain("liga-f");
    expect(ALLOWED_COMPETITIONS).toContain("primera-federacion-fem");
    expect(ALLOWED_COMPETITIONS).toContain("segunda-federacion-fem-g1");
    expect(ALLOWED_COMPETITIONS).toContain("primera-division");
    expect(ALLOWED_COMPETITIONS).toContain("segunda-division");
    expect(ALLOWED_COMPETITIONS).toContain("primera-rfef-g1");
    expect(ALLOWED_COMPETITIONS).toContain("segunda-rfef-g1");
    expect(ALLOWED_COMPETITIONS).toContain("tercera-rfef-g1");
    expect(ALLOWED_COMPETITIONS).toHaveLength(8);
  });

  it("validates competition codes with Zod schema", () => {
    expect(CompetitionCode.safeParse("liga-f").success).toBe(true);
    expect(CompetitionCode.safeParse("primera-federacion-fem").success).toBe(
      true,
    );
    expect(CompetitionCode.safeParse("segunda-federacion-fem-g1").success).toBe(
      true,
    );
    expect(CompetitionCode.safeParse("champions-league").success).toBe(false);
  });

  it("has metadata, official names and short names for women competitions", () => {
    const ligaF = getCompetitionMetadata("liga-f");
    expect(ligaF).toBeDefined();
    expect(ligaF?.officialName).toBe("Liga F Moeve");
    expect(ligaF?.shortName).toBe("Liga F");
    expect(ligaF?.category).toBe("femenino");
    expect(ligaF?.tier).toBe(1);
    expect(ligaF?.featuredGalicianTeamId).toBe("depor-abanca");

    const primeraFedFem = getCompetitionMetadata("primera-federacion-fem");
    expect(primeraFedFem).toBeDefined();
    expect(primeraFedFem?.officialName).toBe("Primera Federación Femenina");
    expect(primeraFedFem?.category).toBe("femenino");
    expect(primeraFedFem?.tier).toBe(2);

    const segundaFedFemG1 = getCompetitionMetadata("segunda-federacion-fem-g1");
    expect(segundaFedFemG1).toBeDefined();
    expect(segundaFedFemG1?.officialName).toBe(
      "Segunda Federación Femenina - Grupo 1",
    );
    expect(segundaFedFemG1?.category).toBe("femenino");
    expect(segundaFedFemG1?.tier).toBe(3);
    expect(segundaFedFemG1?.featuredGalicianTeamId).toBe("as-celtas");
  });

  it("filters competitions by category", () => {
    const women = getCompetitionsByCategory("femenino");
    expect(women).toHaveLength(3);
    expect(women.map((c) => c.id)).toEqual([
      "liga-f",
      "primera-federacion-fem",
      "segunda-federacion-fem-g1",
    ]);

    const men = getCompetitionsByCategory("masculino");
    expect(men).toHaveLength(5);
  });

  it("checks allowed competitions correctly", () => {
    expect(isAllowedCompetition("liga-f")).toBe(true);
    expect(isAllowedCompetition("copa-reina")).toBe(false);
  });
});
