import { z } from "zod";

export const ALLOWED_COMPETITIONS = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
  "liga-f",
  "primera-federacion-fem",
  "segunda-federacion-fem-g1",
] as const;

export const CompetitionCode = z.enum(ALLOWED_COMPETITIONS);
export type CompetitionCode = z.infer<typeof CompetitionCode>;

export type CompetitionCategory = "masculino" | "femenino";

export type CompetitionMetadata = {
  id: CompetitionCode;
  canonicalId: CompetitionCode;
  officialName: string;
  name: string;
  shortName: string;
  category: CompetitionCategory;
  tier: number;
  featuredGalicianTeamId?: string;
};

export const COMPETITIONS_METADATA: Record<
  CompetitionCode,
  CompetitionMetadata
> = {
  "liga-f": {
    id: "liga-f",
    canonicalId: "liga-f",
    officialName: "Liga F Moeve",
    name: "Liga F Moeve",
    shortName: "Liga F",
    category: "femenino",
    tier: 1,
    featuredGalicianTeamId: "depor-abanca",
  },
  "primera-federacion-fem": {
    id: "primera-federacion-fem",
    canonicalId: "primera-federacion-fem",
    officialName: "Primera Federación Femenina",
    name: "Primeira Federación Feminina",
    shortName: "1ª Fed. Fem.",
    category: "femenino",
    tier: 2,
  },
  "segunda-federacion-fem-g1": {
    id: "segunda-federacion-fem-g1",
    canonicalId: "segunda-federacion-fem-g1",
    officialName: "Segunda Federación Femenina - Grupo 1",
    name: "Segunda Federación Feminina · Grupo 1",
    shortName: "2ª Fed. Fem. G1",
    category: "femenino",
    tier: 3,
    featuredGalicianTeamId: "as-celtas",
  },
  "primera-division": {
    id: "primera-division",
    canonicalId: "primera-division",
    officialName: "Primera División",
    name: "Primeira División",
    shortName: "1ª División",
    category: "masculino",
    tier: 1,
    featuredGalicianTeamId: "celta",
  },
  "segunda-division": {
    id: "segunda-division",
    canonicalId: "segunda-division",
    officialName: "Segunda División",
    name: "Segunda División",
    shortName: "2ª División",
    category: "masculino",
    tier: 2,
    featuredGalicianTeamId: "deportivo",
  },
  "primera-rfef-g1": {
    id: "primera-rfef-g1",
    canonicalId: "primera-rfef-g1",
    officialName: "Primera Federación - Grupo 1",
    name: "Primeira Federación · Grupo 1",
    shortName: "1ª RFEF G1",
    category: "masculino",
    tier: 3,
    featuredGalicianTeamId: "lugo",
  },
  "segunda-rfef-g1": {
    id: "segunda-rfef-g1",
    canonicalId: "segunda-rfef-g1",
    officialName: "Segunda Federación - Grupo 1",
    name: "Segunda Federación · Grupo 1",
    shortName: "2ª RFEF G1",
    category: "masculino",
    tier: 4,
    featuredGalicianTeamId: "pontevedra",
  },
  "tercera-rfef-g1": {
    id: "tercera-rfef-g1",
    canonicalId: "tercera-rfef-g1",
    officialName: "Tercera Federación - Grupo 1",
    name: "Terceira Federación · Grupo 1",
    shortName: "3ª RFEF G1",
    category: "masculino",
    tier: 5,
  },
};

export function isAllowedCompetition(id: string): id is CompetitionCode {
  return (ALLOWED_COMPETITIONS as readonly string[]).includes(id);
}

export function getCompetitionMetadata(
  id: string,
): CompetitionMetadata | undefined {
  if (isAllowedCompetition(id)) {
    return COMPETITIONS_METADATA[id];
  }
  return undefined;
}

export function getCompetitionsByCategory(
  category: CompetitionCategory,
): CompetitionMetadata[] {
  return Object.values(COMPETITIONS_METADATA).filter(
    (c) => c.category === category,
  );
}
