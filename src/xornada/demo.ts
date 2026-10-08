import { z } from "zod";
import { PublicMatch } from "@/model";

// Demonstration data for /demo/xornada (SPEC-019 CA-5): the five competitions
// of D-3 with the real names of the declared calendar (data/calendario/2026-27)
// and every case of the view model. Invented results, never shown in
// production (isDemoAvailable).

type Side = { name: string; shortName: string | null };
type Competition = {
  competitionId: string;
  competitionName: string;
  tier: number;
  round: number;
};

const PRIMERA: Competition = {
  competitionId: "primera-division",
  competitionName: "Primeira División",
  tier: 1,
  round: 8,
};
const SEGUNDA: Competition = {
  competitionId: "segunda-division",
  competitionName: "Segunda División",
  tier: 2,
  round: 9,
};
const PRIMERA_RFEF: Competition = {
  competitionId: "primera-rfef-g1",
  competitionName: "Primeira Federación · Grupo 1",
  tier: 3,
  round: 6,
};
const SEGUNDA_RFEF: Competition = {
  competitionId: "segunda-rfef-g1",
  competitionName: "Segunda Federación · Grupo 1",
  tier: 4,
  round: 5,
};
const TERCERA_RFEF: Competition = {
  competitionId: "tercera-rfef-g1",
  competitionName: "Terceira Federación · Grupo 1",
  tier: 5,
  round: 5,
};

const team = (name: string, shortName: string | null = null): Side => ({
  name,
  shortName,
});

const OBSERVED = "2026-10-03T16:58:00Z";
const DECIDED = "2026-10-03T16:58:04Z";

type State =
  | { status: "scheduled"; score: null; minute: null }
  | {
      status: "live";
      score: { home: number; away: number };
      minute: number | null;
      addedMinute: number | null;
      halfTime: boolean;
    }
  | {
      status: "finished" | "suspended";
      score: { home: number; away: number };
      minute: null;
    }
  | { status: "postponed"; score: null; minute: null };

const scheduled = (): State => ({
  status: "scheduled",
  score: null,
  minute: null,
});
const postponed = (): State => ({
  status: "postponed",
  score: null,
  minute: null,
});
const live = (
  home: number,
  away: number,
  minute: number | null,
  addedMinute: number | null = null,
): State => ({
  status: "live",
  score: { home, away },
  minute,
  addedMinute,
  halfTime: false,
});
// SPEC-021: half-time, with the minute the source still reports (N-3).
const halfTime = (home: number, away: number): State => ({
  status: "live",
  score: { home, away },
  minute: 45,
  addedMinute: null,
  halfTime: true,
});
const finished = (home: number, away: number): State => ({
  status: "finished",
  score: { home, away },
  minute: null,
});
const suspended = (home: number, away: number): State => ({
  status: "suspended",
  score: { home, away },
  minute: null,
});

const slug = (s: Side) =>
  s.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function demoMatch(
  competition: Competition,
  kickoff: string,
  home: Side,
  away: Side,
  state: State,
  qualifier: "confirmado" | "provisional" | "sen_sinal" = "confirmado",
): unknown {
  const undecided = state.status === "scheduled" && qualifier === "confirmado";
  return {
    matchId: `${competition.competitionId}-2026-27-j${competition.round}-${slug(home)}-${slug(away)}`,
    ...competition,
    kickoff,
    home,
    away,
    ...state,
    qualifier,
    version: undecided ? 0 : 3,
    observedAt: undecided ? null : OBSERVED,
    decidedAt: undecided ? null : DECIDED,
  };
}

const RAW: unknown[] = [
  // Deliberately shuffled: buildXornada orders competitions and rows.
  demoMatch(
    TERCERA_RFEF,
    "2026-10-03T17:00:00Z",
    team("Racing Villalbés", "Villalbés"),
    team("CD Estradense", "Estradense"),
    scheduled(),
  ),
  demoMatch(
    TERCERA_RFEF,
    "2026-10-03T16:00:00Z",
    team("CD Barco", "Barco"),
    team("Atlético Coruña Montañeros", "Montañeros"),
    live(0, 2, 29),
  ),
  demoMatch(
    TERCERA_RFEF,
    "2026-10-03T14:00:00Z",
    team("Silva SD", "Silva"),
    team("UD Somozas", "Somozas"),
    finished(1, 1),
  ),
  demoMatch(
    TERCERA_RFEF,
    "2026-10-03T18:00:00Z",
    team("Portonovo SD", "Portonovo"),
    team("Pontevedra CF B", "Pontevedra B"),
    scheduled(),
  ),

  demoMatch(
    PRIMERA,
    "2026-10-03T16:15:00Z",
    team("RC Celta", "Celta"),
    team("Real Madrid"),
    live(1, 0, 45, 3),
  ),
  demoMatch(
    PRIMERA,
    "2026-10-03T16:00:00Z",
    team("RC Deportivo", "Deportivo"),
    team("Sevilla FC", "Sevilla"),
    live(2, 1, 46),
    "provisional",
  ),
  demoMatch(
    PRIMERA,
    "2026-10-03T12:00:00Z",
    team("Real Betis", "Betis"),
    team("Villarreal CF", "Villarreal"),
    finished(2, 2),
  ),
  demoMatch(
    PRIMERA,
    "2026-10-03T19:00:00Z",
    team("Athletic Club", "Athletic"),
    team("Real Sociedad"),
    scheduled(),
  ),

  demoMatch(
    SEGUNDA_RFEF,
    "2026-10-03T15:00:00Z",
    team("SD Compostela", "Compostela"),
    team("Ourense CF"),
    live(2, 0, 90, 5),
  ),
  demoMatch(
    SEGUNDA_RFEF,
    "2026-10-03T16:30:00Z",
    team("Coruxo FC", "Coruxo"),
    team("Rayo Cantabria"),
    postponed(),
  ),
  demoMatch(
    SEGUNDA_RFEF,
    "2026-10-03T16:30:00Z",
    team("Arosa SC", "Arosa"),
    team("Bergantiños FC", "Bergantiños"),
    postponed(),
    "provisional",
  ),
  demoMatch(
    SEGUNDA_RFEF,
    "2026-10-03T14:00:00Z",
    team("Sestao River Club", "Sestao River"),
    team("RS Gimnástica de Torrelavega", "Gimnástica"),
    suspended(0, 1),
    "provisional",
  ),

  demoMatch(
    SEGUNDA,
    "2026-10-03T16:30:00Z",
    team("Celta Fortuna"),
    team("CE Sabadell", "Sabadell"),
    live(0, 0, null),
  ),
  demoMatch(
    SEGUNDA,
    "2026-10-03T16:15:00Z",
    team("Granada CF", "Granada"),
    team("FC Andorra", "Andorra"),
    halfTime(0, 2),
  ),
  demoMatch(
    SEGUNDA,
    "2026-10-03T16:15:00Z",
    team("Girona FC", "Girona"),
    team("CD Tenerife", "Tenerife"),
    halfTime(1, 1),
    "sen_sinal",
  ),
  demoMatch(
    SEGUNDA,
    "2026-10-03T12:00:00Z",
    team("Real Oviedo", "Oviedo"),
    team("Real Sporting", "Sporting"),
    finished(0, 1),
  ),
  demoMatch(
    SEGUNDA,
    "2026-10-03T14:15:00Z",
    team("Albacete Balompié", "Albacete"),
    team("Cádiz CF", "Cádiz"),
    finished(2, 1),
    "provisional",
  ),
  demoMatch(
    SEGUNDA,
    "2026-10-03T16:00:00Z",
    team("Real Sociedad B"),
    team("Burgos CF", "Burgos"),
    scheduled(),
    "sen_sinal",
  ),

  demoMatch(
    PRIMERA_RFEF,
    "2026-10-03T16:00:00Z",
    team("Bilbao Athletic"),
    team("UD Ourense"),
    live(0, 0, 67),
    "sen_sinal",
  ),
  demoMatch(
    PRIMERA_RFEF,
    "2026-10-03T14:00:00Z",
    team("Pontevedra CF", "Pontevedra"),
    team("Zamora CF", "Zamora"),
    finished(1, 0),
  ),
  demoMatch(
    PRIMERA_RFEF,
    "2026-10-03T15:00:00Z",
    team("Racing de Ferrol", "Racing Ferrol"),
    team("CD Lugo", "Lugo"),
    suspended(1, 1),
  ),
  demoMatch(
    PRIMERA_RFEF,
    "2026-10-03T18:30:00Z",
    team("Unionistas de Salamanca CF", "Unionistas"),
    team("Real Avilés Industrial", "Avilés"),
    scheduled(),
  ),
];

export const DEMO_MATCHES: readonly PublicMatch[] = z
  .array(PublicMatch)
  .parse(RAW);

// The demonstration route never exists in production (SPEC-019 CA-5).
export function isDemoAvailable(env: { VERCEL_ENV?: string }): boolean {
  return env.VERCEL_ENV !== "production";
}
