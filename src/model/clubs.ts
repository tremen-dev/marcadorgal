export type GalicianClub = {
  id: string;
  canonicalId: string;
  name: string;
  shortName: string;
  competitionId: string;
  gender: "masculino" | "femenino";
  city: string;
  shield: string;
  stadium?: string;
  isGalician: true;
};

export const GALICIAN_CLUBS: Record<string, GalicianClub> = {
  "depor-abanca": {
    id: "depor-abanca",
    canonicalId: "depor-abanca",
    name: "Deportivo ABANCA",
    shortName: "Depor ABANCA",
    competitionId: "liga-f",
    gender: "femenino",
    city: "A Coruña",
    stadium: "Cidade Deportiva de Abegondo / Riazor",
    shield: "/escudos/depor-abanca.svg",
    isGalician: true,
  },
  "as-celtas": {
    id: "as-celtas",
    canonicalId: "as-celtas",
    name: "RC Celta Femenino / As Celtas",
    shortName: "As Celtas",
    competitionId: "segunda-federacion-fem-g1",
    gender: "femenino",
    city: "Vigo",
    stadium: "A Madroa / Balaídos",
    shield: "/escudos/as-celtas.svg",
    isGalician: true,
  },
  "depor-abanca-b": {
    id: "depor-abanca-b",
    canonicalId: "depor-abanca-b",
    name: "Deportivo ABANCA B",
    shortName: "Depor ABANCA B",
    competitionId: "segunda-federacion-fem-g1",
    gender: "femenino",
    city: "A Coruña",
    stadium: "Cidade Deportiva de Abegondo",
    shield: "/escudos/depor-abanca.svg",
    isGalician: true,
  },
  "lugo-femenino": {
    id: "lugo-femenino",
    canonicalId: "lugo-femenino",
    name: "CD Lugo Femenino",
    shortName: "Lugo Fem.",
    competitionId: "segunda-federacion-fem-g1",
    gender: "femenino",
    city: "Lugo",
    stadium: "A Campiña",
    shield: "/escudos/lugo.svg",
    isGalician: true,
  },
  celta: {
    id: "celta",
    canonicalId: "celta",
    name: "RC Celta",
    shortName: "Celta",
    competitionId: "primera-division",
    gender: "masculino",
    city: "Vigo",
    stadium: "Abanca-Balaídos",
    shield: "/escudos/celta.svg",
    isGalician: true,
  },
  deportivo: {
    id: "deportivo",
    canonicalId: "deportivo",
    name: "RC Deportivo",
    shortName: "Deportivo",
    competitionId: "segunda-division",
    gender: "masculino",
    city: "A Coruña",
    stadium: "Abanca-Riazor",
    shield: "/escudos/deportivo.svg",
    isGalician: true,
  },
  "racing-ferrol": {
    id: "racing-ferrol",
    canonicalId: "racing-ferrol",
    name: "Racing Club de Ferrol",
    shortName: "Racing Ferrol",
    competitionId: "segunda-division",
    gender: "masculino",
    city: "Ferrol",
    stadium: "A Malata",
    shield: "/escudos/racing-ferrol.svg",
    isGalician: true,
  },
  lugo: {
    id: "lugo",
    canonicalId: "lugo",
    name: "CD Lugo",
    shortName: "Lugo",
    competitionId: "primera-rfef-g1",
    gender: "masculino",
    city: "Lugo",
    stadium: "Anxo Carro",
    shield: "/escudos/lugo.svg",
    isGalician: true,
  },
  pontevedra: {
    id: "pontevedra",
    canonicalId: "pontevedra",
    name: "Pontevedra CF",
    shortName: "Pontevedra",
    competitionId: "segunda-rfef-g1",
    gender: "masculino",
    city: "Pontevedra",
    stadium: "Pasarón",
    shield: "/escudos/pontevedra.svg",
    isGalician: true,
  },
  "ourense-cf": {
    id: "ourense-cf",
    canonicalId: "ourense-cf",
    name: "Ourense CF",
    shortName: "Ourense CF",
    competitionId: "primera-rfef-g1",
    gender: "masculino",
    city: "Ourense",
    stadium: "O Couto",
    shield: "/escudos/ourense-cf.svg",
    isGalician: true,
  },
};

export function getGalicianClub(id: string): GalicianClub | undefined {
  return GALICIAN_CLUBS[id];
}

export function isGalicianClub(id: string): boolean {
  return id in GALICIAN_CLUBS;
}

export function getClubShield(teamIdOrName: string): string | undefined {
  const byId = GALICIAN_CLUBS[teamIdOrName];
  if (byId) return byId.shield;
  const normalized = teamIdOrName.toLowerCase();
  for (const club of Object.values(GALICIAN_CLUBS)) {
    if (
      normalized.includes(club.id) ||
      normalized.includes(club.name.toLowerCase()) ||
      normalized.includes(club.shortName.toLowerCase())
    ) {
      return club.shield;
    }
  }
  return undefined;
}
