import type { AliasFile, PublicGoal, PublicMatch } from "../model/index.ts";
import { withDeadline as deadline } from "./deadline.ts";
import { type DayMatchesResponse, getDayMatches } from "./explorer-client.ts";
import {
  candidateOf,
  type ExplorerRow,
  isSamePublicMatch,
  pickRow,
} from "./explorer-identity.ts";

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

    // SPEC-094 CA-4: a goal without a usable minute stays, without the key.
    const minute =
      typeof g.minute === "number" && !Number.isNaN(g.minute)
        ? Math.max(0, Math.round(g.minute))
        : null;

    result.push({
      team,
      player,
      ...(minute === null ? {} : { minute }),
      ...(g.penalty === true ? { penalty: true } : {}),
      ...(g.ownGoal === true ? { ownGoal: true } : {}),
    });
  }

  // Ordenar por minuto cronolóxico; os sen minuto, ao final (SPEC-094 CA-4).
  return result.sort(
    (a, b) =>
      (a.minute ?? Number.POSITIVE_INFINITY) -
      (b.minute ?? Number.POSITIVE_INFINITY),
  );
}

/**
 * Comproba se un partido de Explorer é o PublicMatch de marcador.gal pola
 * identidade de SPEC-070 (competición e os dous equipos resoltos por alias ou
 * por id canónico igual), nunca por nomes parecidos.
 */
export function isMatchEqual(
  pm: PublicMatch,
  em: DayMatchesResponse["matches"][number],
  aliases: AliasFile | null = null,
): boolean {
  return isSamePublicMatch(pm, em, aliases);
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
 * Límite para cada consulta a Explorer no enriquecemento (SPEC-059 CA-4). A
 * portada, a vista de xornada e /api/board agardan por ela antes de responder,
 * e os goleadores son un engadido: mellor sen eles que unha portada lenta.
 * Ningunha spec nin ADR fixa a cifra; 2 s cobren unha resposta normal do
 * export (centos de ms) e o arranque en frío dunha función de Vercel, e
 * cortan o resto. Os demais usos de explorer-client non levan este límite.
 */
export const EXPLORER_ENRICHMENT_TIMEOUT_MS = 2000;

export type EnrichmentOptions = { timeoutMs?: number };

/**
 * Enriquece os partidos de PublicMatch cos goles procedentes da API Explorer.
 *
 * @param matches Partidos actuais da xornada (normalmente de Postgres web.xornada).
 * @param fetcher Inxectador de fetch para facilitar probas unitarias (por defecto getDayMatches).
 * @param aliases Alias rfef da tempada (SPEC-070 CA-11); sen el, a competición
 *   sae só de canonicalCompetitionId e os equipos só de ids canónicos iguais.
 * @param options.timeoutMs Límite por consulta (por defecto
 *   EXPLORER_ENRICHMENT_TIMEOUT_MS); pasado, a data quédase sen goles.
 */
export async function enrichMatchesWithGoals(
  matches: PublicMatch[],
  fetcher?: (date: string) => Promise<DayMatchesResponse>,
  aliases: AliasFile | null = null,
  options: EnrichmentOptions = {},
): Promise<PublicMatch[]> {
  const timeoutMs = options.timeoutMs ?? EXPLORER_ENRICHMENT_TIMEOUT_MS;
  // O fetcher por defecto aborta de verdade a petición (libera o socket); o
  // withDeadline de abaixo garante o límite tamén para fetchers inxectados.
  const fetchDay =
    fetcher ??
    ((date: string) => getDayMatches(date, undefined, { timeoutMs }));
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

  // Todas as filas de cada día, con ou sen goles: a ambigüidade mírase sobre
  // todas (SPEC-070 CA-5), non só sobre as que traen goles.
  const rowsByDate = new Map<string, ExplorerRow[]>();
  const results = await Promise.allSettled(
    dates.map((date) =>
      deadline(fetchDay(date), timeoutMs, "explorer-enrichment"),
    ),
  );
  results.forEach((res, i) => {
    if (res.status === "fulfilled" && Array.isArray(res.value?.matches)) {
      rowsByDate.set(dates[i] as string, res.value.matches);
    }
  });

  if (rowsByDate.size === 0) {
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

    const rows = rowsByDate.get(toMadridDate(m.kickoff)) ?? [];
    const pairing = pickRow(
      rows,
      (row) => isMatchEqual(m, row, aliases),
      m.kickoff,
    );
    if (pairing.kind === "ambiguous") {
      console.warn(
        `[explorer-enrichment] ${m.matchId}: varias filas do export cumpren a identidade, sen goles:`,
        pairing.candidates
          .map((r) => {
            const c = candidateOf(r);
            return `${c.codActa ?? "sen acta"} ${c.home ?? "?"}–${c.away ?? "?"}`;
          })
          .join("; "),
      );
      return m;
    }
    if (pairing.kind !== "paired" || !Array.isArray(pairing.row.goals)) {
      return m;
    }

    const cleanGoals = sanitizeGoals(pairing.row.goals);
    if (cleanGoals.length === 0) {
      return m;
    }

    return {
      ...m,
      goals: cleanGoals,
    };
  });
}
