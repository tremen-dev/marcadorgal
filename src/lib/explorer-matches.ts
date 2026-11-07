import {
  type CompetitionCategory,
  type CompetitionMetadata,
  getCompetitionMetadata,
  getGalicianClub,
  isGalicianClub,
} from "../model/index.ts";
import type { DayMatchesResponse } from "./explorer-client.ts";

export type TransformedGoal = {
  team: "home" | "away";
  player: string;
  minute: number;
  penalty?: boolean;
  ownGoal?: boolean;
};

export type TransformedMatch = {
  id: string;
  matchKey?: string;
  codActa: string | null;
  competitionId: string;
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  canonicalHomeTeamId?: string;
  canonicalAwayTeamId?: string;
  homeGalician: boolean;
  awayGalician: boolean;
  homeShield?: string;
  awayShield?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "finished" | "postponed" | "suspended";
  originalStatus: string;
  minute: number | null;
  addedMinute: number | null;
  halfTime: boolean;
  goals: TransformedGoal[];
  liveProvider?: "marca" | "rfef";
};

export type GroupedCompetitionMatches = {
  competitionId: string;
  competitionName: string;
  metadata?: CompetitionMetadata;
  category: CompetitionCategory;
  tier: number;
  liveCount: number;
  matches: TransformedMatch[];
};

export function mapExplorerStatus(
  status: string,
): "scheduled" | "live" | "finished" | "postponed" | "suspended" {
  switch (status) {
    case "LIVE_PROVISIONAL":
      return "live";
    case "FINISHED":
      return "finished";
    case "POSTPONED":
      return "postponed";
    case "SUSPENDED":
      return "suspended";
    default:
      return "scheduled";
  }
}

export function transformExplorerMatches(
  data: DayMatchesResponse,
): GroupedCompetitionMatches[] {
  const groups = new Map<string, TransformedMatch[]>();

  for (const raw of data.matches) {
    const compId = raw.canonicalCompetitionId || "outras-competicions";
    const homeTeam = raw.homeTeam || raw.equipoLocal || "Local";
    const awayTeam = raw.awayTeam || raw.equipoVisitante || "Visitante";
    const homeCanonical = raw.canonicalHomeTeamId;
    const awayCanonical = raw.canonicalAwayTeamId;

    const homeClub = homeCanonical ? getGalicianClub(homeCanonical) : undefined;
    const awayClub = awayCanonical ? getGalicianClub(awayCanonical) : undefined;

    const homeGalician = Boolean(
      (homeCanonical && isGalicianClub(homeCanonical)) ||
        homeClub ||
        homeTeam.toLowerCase().includes("deportivo abanca") ||
        homeTeam.toLowerCase().includes("as celtas") ||
        homeTeam.toLowerCase().includes("celta") ||
        homeTeam.toLowerCase().includes("deportivo"),
    );

    const awayGalician = Boolean(
      (awayCanonical && isGalicianClub(awayCanonical)) ||
        awayClub ||
        awayTeam.toLowerCase().includes("deportivo abanca") ||
        awayTeam.toLowerCase().includes("as celtas") ||
        awayTeam.toLowerCase().includes("celta") ||
        awayTeam.toLowerCase().includes("deportivo"),
    );

    const homeScore =
      raw.homeScore !== undefined && raw.homeScore !== null
        ? raw.homeScore
        : raw.golesLocal !== undefined
          ? raw.golesLocal
          : null;

    const awayScore =
      raw.awayScore !== undefined && raw.awayScore !== null
        ? raw.awayScore
        : raw.golesVisitante !== undefined
          ? raw.golesVisitante
          : null;

    const match: TransformedMatch = {
      id:
        raw.matchKey ||
        raw.codActa ||
        `${compId}-${homeCanonical || homeTeam}-${awayCanonical || awayTeam}`,
      matchKey: raw.matchKey,
      codActa: raw.codActa ?? null,
      competitionId: compId,
      competitionName: getCompetitionMetadata(compId)?.officialName || compId,
      homeTeam,
      awayTeam,
      canonicalHomeTeamId: homeCanonical,
      canonicalAwayTeamId: awayCanonical,
      homeGalician,
      awayGalician,
      homeShield: homeClub?.shield,
      awayShield: awayClub?.shield,
      homeScore,
      awayScore,
      status: mapExplorerStatus(raw.estado),
      originalStatus: raw.estado,
      minute: raw.minute ?? null,
      addedMinute: raw.addedMinute ?? null,
      halfTime: Boolean(raw.halfTime),
      goals: (raw.goals || []).map((g) => ({
        team: g.team,
        player: g.player,
        minute: g.minute,
        penalty: g.penalty,
        ownGoal: g.ownGoal,
      })),
      liveProvider: raw.liveProvider,
    };

    const existing = groups.get(compId) ?? [];
    existing.push(match);
    groups.set(compId, existing);
  }

  const result: GroupedCompetitionMatches[] = [];

  for (const [competitionId, matches] of groups.entries()) {
    const meta = getCompetitionMetadata(competitionId);
    const category = meta?.category || "femenino";
    const tier = meta?.tier || 99;
    const liveCount = matches.filter((m) => m.status === "live").length;

    result.push({
      competitionId,
      competitionName: meta?.officialName || competitionId,
      metadata: meta,
      category,
      tier,
      liveCount,
      matches,
    });
  }

  // Sort: Women's competitions first if female, or tier ascending
  return result.sort((a, b) => {
    // If different category, let caller filter or sort by tier
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.competitionName.localeCompare(b.competitionName);
  });
}
