import type { PublicGoal, PublicMatch } from "../model/index.ts";
import { type DayMatchesResponse, getDayMatches } from "./explorer-client.ts";

/**
 * Filtra de forma defensiva calquera gol con autor sintético ou formato inválido.
 */
export function sanitizeGoals(rawGoals: unknown[]): PublicGoal[] {
  const result: PublicGoal[] = [];

  for (const item of rawGoals) {
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;

    const team = g.team;
    if (team !== "home" && team !== "away") continue;

    if (typeof g.player !== "string") continue;
    const player = g.player.trim();
    if (!player) continue;

    const lower = player.toLowerCase();
    if (
      lower === "goleador local" ||
      lower === "goleador visitante" ||
      lower.startsWith("goleador ")
    ) {
      continue;
    }

    const minute =
      typeof g.minute === "number" && !Number.isNaN(g.minute)
        ? Math.max(0, Math.round(g.minute))
        : null;

    if (minute === null) continue;

    result.push({
      team,
      player,
      minute,
      ...(g.penalty === true ? { penalty: true } : {}),
      ...(g.ownGoal === true ? { ownGoal: true } : {}),
    });
  }

  // Ordenar por minuto cronolóxico
  return result.sort((a, b) => a.minute - b.minute);
}

/**
 * Normaliza un nome de equipo ou slug para permitir matching tolerante.
 */
function normalizeSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const NOISE_WORDS = new Set([
  "cf",
  "cd",
  "ud",
  "sd",
  "rc",
  "fc",
  "sad",
  "club",
  "futbol",
  "deportivo",
  "deportiva",
  "de",
]);

function toTokenSet(str: string): Set<string> {
  const tokens = normalizeSlug(str)
    .split("-")
    .filter((w) => w.length > 2 && !NOISE_WORDS.has(w));
  return new Set(tokens);
}

function areTeamsSimilar(
  nameA: string,
  shortA: string | null | undefined,
  nameB: string,
): boolean {
  const normA = normalizeSlug(nameA);
  const normB = normalizeSlug(nameB);
  if (normA.includes(normB) || normB.includes(normA)) return true;

  if (shortA) {
    const normShort = normalizeSlug(shortA);
    if (normB.includes(normShort) || normShort.includes(normB)) return true;
  }

  const tokensA = toTokenSet(shortA ? `${nameA} ${shortA}` : nameA);
  const tokensB = toTokenSet(nameB);
  if (tokensA.size > 0 && tokensB.size > 0) {
    for (const t of tokensA) {
      if (tokensB.has(t)) return true;
    }
  }

  return false;
}

/**
 * Comproba se un partido de Explorer coincide cun PublicMatch de marcador.gal.
 */
export function isMatchEqual(
  pm: PublicMatch,
  em: DayMatchesResponse["matches"][number],
): boolean {
  // 1. Por canonicalCompetitionId (se existe e non coincide, non é o mesmo partido)
  if (
    em.canonicalCompetitionId &&
    em.canonicalCompetitionId !== pm.competitionId
  ) {
    return false;
  }

  const matchIdSlug = pm.matchId.toLowerCase();

  // 2. Coincidencia por canonicalHomeTeamId e canonicalAwayTeamId
  if (em.canonicalHomeTeamId && em.canonicalAwayTeamId) {
    const homeSlug = normalizeSlug(em.canonicalHomeTeamId);
    const awaySlug = normalizeSlug(em.canonicalAwayTeamId);
    if (matchIdSlug.includes(homeSlug) && matchIdSlug.includes(awaySlug)) {
      return true;
    }
  }

  // 3. Coincidencia por nomes normalizados de equipo
  const emHomeName = em.homeTeam || em.equipoLocal;
  const emAwayName = em.awayTeam || em.equipoVisitante;

  if (emHomeName && emAwayName) {
    const homeMatch = areTeamsSimilar(
      pm.home.name,
      pm.home.shortName,
      emHomeName,
    );
    const awayMatch = areTeamsSimilar(
      pm.away.name,
      pm.away.shortName,
      emAwayName,
    );

    if (homeMatch && awayMatch) {
      return true;
    }
  }

  return false;
}

const madridFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toMadridDate(isoInstant: string): string {
  const ts = Date.parse(isoInstant);
  if (Number.isNaN(ts)) return isoInstant.slice(0, 10);
  const parts = new Map(
    madridFormatter.formatToParts(ts).map((p) => [p.type, p.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

/**
 * Enriquece os partidos de PublicMatch cos goles procedentes da API Explorer.
 *
 * @param matches Partidos actuais da xornada (normalmente de Postgres web.xornada).
 * @param fetcher Inxectador de fetch para facilitar probas unitarias (por defecto getDayMatches).
 */
export async function enrichMatchesWithGoals(
  matches: PublicMatch[],
  fetcher: (date: string) => Promise<DayMatchesResponse> = getDayMatches,
): Promise<PublicMatch[]> {
  if (!matches || matches.length === 0) {
    return matches;
  }

  // Partidos candidatos a ter goles (partidos con goles rexistrados ou en directo)
  // que non teñan xa goles asignados
  const candidates = matches.filter((m) => {
    if (m.goals && m.goals.length > 0) return false;
    if (m.status === "live") return true;
    if (m.score && (m.score.home > 0 || m.score.away > 0)) return true;
    return false;
  });

  if (candidates.length === 0) {
    return matches;
  }

  // Recoller datas únicas dos partidos candidatos (formato YYYY-MM-DD en Europe/Madrid)
  const dates = [...new Set(candidates.map((m) => toMadridDate(m.kickoff)))];

  const explorerMatches: DayMatchesResponse["matches"] = [];

  const results = await Promise.allSettled(dates.map((date) => fetcher(date)));

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value?.matches)) {
      for (const m of res.value.matches) {
        if (Array.isArray(m.goals) && m.goals.length > 0) {
          explorerMatches.push(m);
        }
      }
    }
  }

  if (explorerMatches.length === 0) {
    return matches;
  }

  // Enriquecer cada partido se atopamos coincidencia con goles válidos
  return matches.map((m) => {
    // Se xa ten goles, respectámolos
    if (m.goals && m.goals.length > 0) {
      return m;
    }

    // Só enriquecemos se o partido está en directo ou ten marcador con goles
    const hasGoalsInScore =
      m.status === "live" ||
      (m.score !== null && (m.score.home > 0 || m.score.away > 0));

    if (!hasGoalsInScore) {
      return m;
    }

    const found = explorerMatches.find((em) => isMatchEqual(m, em));
    if (!found || !Array.isArray(found.goals)) {
      return m;
    }

    const cleanGoals = sanitizeGoals(found.goals);
    if (cleanGoals.length === 0) {
      return m;
    }

    return {
      ...m,
      goals: cleanGoals,
    };
  });
}
