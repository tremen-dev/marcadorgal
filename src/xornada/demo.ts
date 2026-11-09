import { z } from "zod";
import { type Instant, type PublicGoal, PublicMatch } from "@/model";

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
  // SPEC-068 CA-8: the scorers, as many per side as the score says.
  goals?: PublicGoal[],
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
    homeScoredAt: null,
    awayScoredAt: null,
    ...(goals === undefined ? {} : { goals }),
  };
}

// SPEC-068 CA-8: invented scorers (the results are invented too). Given out
// of minute order on purpose: the row sorts them.
const goal = (
  team: "home" | "away",
  minute: number,
  player: string,
  kind?: "penalty" | "ownGoal",
): PublicGoal => ({
  team,
  player,
  minute,
  ...(kind === undefined ? {} : { [kind]: true }),
});

const RAW: unknown[] = [
  // Deliberately shuffled: buildXornada orders competitions and rows.
  // SPEC-023 CA-8: Friday to Monday; Saturday and Sunday each have live,
  // finished and scheduled rows.
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
    "2026-10-02T17:00:00Z",
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
    "confirmado",
    [goal("home", 44, "Borja Iglesias")],
  ),
  demoMatch(
    PRIMERA,
    "2026-10-03T16:00:00Z",
    team("Sevilla FC", "Sevilla"),
    team("Getafe CF", "Getafe"),
    live(2, 1, 46),
    "provisional",
  ),
  // SPEC-033 CA-7: an Equipo galego that loses to a non-galician.
  // SPEC-068 CA-8: both sides score, a penalty, an own goal and a name that
  // does not fit one line at 360 px.
  demoMatch(
    PRIMERA,
    "2026-10-04T10:00:00Z",
    team("Real Betis", "Betis"),
    team("RC Deportivo", "Deportivo"),
    finished(2, 1),
    "confirmado",
    [
      goal("home", 67, "Francisco José Sánchez Rodríguez de la Fuente"),
      goal("away", 80, "Natan Bernardo de Souza", "ownGoal"),
      goal("home", 23, "Isco Alarcón", "penalty"),
    ],
  ),
  demoMatch(
    PRIMERA,
    "2026-10-05T19:00:00Z",
    team("Athletic Club", "Athletic"),
    team("Real Sociedad"),
    scheduled(),
  ),

  demoMatch(
    SEGUNDA_RFEF,
    "2026-10-04T15:00:00Z",
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
    "2026-10-02T18:30:00Z",
    team("Real Oviedo", "Oviedo"),
    team("Real Sporting", "Sporting"),
    finished(0, 1),
    "confirmado",
    // SPEC-041 CA-6 (H-6): the away side scored 1 min ago (RECENT_GOALS).
    [goal("away", 88, "Jonathan Dubasin")],
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
    // SPEC-041 CA-6: the longest name, on the side that just scored.
    // SPEC-068 CA-8: its scorer, the recent one; goals of one side only.
    live(1, 0, 67),
    "sen_sinal",
    [goal("home", 66, "Unai Gómez")],
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
    "2026-10-04T16:30:00Z",
    team("Unionistas de Salamanca CF", "Unionistas"),
    team("Real Avilés Industrial", "Avilés"),
    scheduled(),
  ),
];

// SPEC-023: the demonstration's «now», so its strip has a today (Saturday).
export const DEMO_NOW = "2026-10-03T16:50:00Z";

// SPEC-033 CA-4: the season of its names, for the Equipo galego.
export const DEMO_SEASON = "2026-27";

export const DEMO_MATCHES: readonly PublicMatch[] = z
  .array(PublicMatch)
  .parse(RAW);

// SPEC-041 CA-6: the goals of the demonstration, relative to the instant of
// its render (the page is rendered per request): a home goal of 1 min ago in
// a live (Bilbao Athletic, the longest name), an away goal of 1 min ago in a
// finished (H-6) and a home goal of 6 min ago, no longer marked.
const RECENT_GOALS: readonly [
  matchId: string,
  side: "home" | "away",
  minutesAgo: number,
][] = [
  ["primera-rfef-g1-2026-27-j6-bilbao-athletic-ud-ourense", "home", 1],
  ["segunda-division-2026-27-j9-real-oviedo-real-sporting", "away", 1],
  ["segunda-rfef-g1-2026-27-j5-sd-compostela-ourense-cf", "home", 6],
];

export function demoMatches(now: Instant): PublicMatch[] {
  const at = (minutesAgo: number) =>
    new Date(Date.parse(now) - minutesAgo * 60_000).toISOString();
  return DEMO_MATCHES.map((m) => {
    const goal = RECENT_GOALS.find(([id]) => id === m.matchId);
    if (goal === undefined) return m;
    const [, side, minutesAgo] = goal;
    return PublicMatch.parse({
      ...m,
      [side === "home" ? "homeScoredAt" : "awayScoredAt"]: at(minutesAgo),
    });
  });
}

// The demonstration route never exists in production (SPEC-019 CA-5).
export function isDemoAvailable(env: { VERCEL_ENV?: string }): boolean {
  return env.VERCEL_ENV !== "production";
}
