import { describe, expect, it, vi } from "vitest";
import type {
  CompetitionId,
  Instant,
  MatchId,
  PublicMatch,
} from "../model/index.ts";
import type { DayMatchesResponse } from "./explorer-client.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  enrichMatchesWithGoals,
  isMatchEqual,
  sanitizeGoals,
  toMadridDate,
} from "./explorer-enrichment.ts";

function createMockMatch(overrides: Partial<PublicMatch> = {}): PublicMatch {
  return {
    matchId: "primera-division-2026-27-j12-valencia-real-madrid" as MatchId,
    competitionId: "primera-division" as CompetitionId,
    competitionName: "Primeira División",
    tier: 1,
    round: 12,
    kickoff: "2026-11-07T20:00:00.000Z" as Instant,
    home: { name: "Valencia CF", shortName: "Valencia" },
    away: { name: "Real Madrid CF", shortName: "Real Madrid" },
    status: "finished",
    score: { home: 0, away: 3 },
    qualifier: "confirmado",
    version: 1,
    observedAt: "2026-11-07T22:00:00.000Z" as Instant,
    decidedAt: "2026-11-07T22:00:00.000Z" as Instant,
    homeScoredAt: null,
    awayScoredAt: null,
    ...overrides,
  } as PublicMatch;
}

describe("explorer-enrichment", () => {
  describe("sanitizeGoals", () => {
    it("filters out invalid items and empty objects", () => {
      const raw = [null, undefined, "gol", {}, { team: "home" }];
      expect(sanitizeGoals(raw)).toEqual([]);
    });

    it("filters out synthetic placeholders (Goleador Local / Visitante)", () => {
      const raw = [
        { team: "home", player: "Goleador Local", minute: 10 },
        { team: "away", player: "Goleador Visitante", minute: 20 },
        { team: "home", player: "goleador local", minute: 30 },
        { team: "away", player: "Goleador 2", minute: 40 },
        { team: "away", player: "Kylian Mbappé", minute: 75 },
      ];
      const result = sanitizeGoals(raw);
      expect(result).toEqual([
        { team: "away", player: "Kylian Mbappé", minute: 75 },
      ]);
    });

    it("accepts valid goals and sorts chronologically by minute", () => {
      const raw = [
        { team: "away", player: "Mbappé", minute: 75 },
        { team: "away", player: "Valverde", minute: 28 },
        { team: "away", player: "Güler", minute: 36, penalty: true },
      ];
      const result = sanitizeGoals(raw);
      expect(result).toEqual([
        { team: "away", player: "Valverde", minute: 28 },
        { team: "away", player: "Güler", minute: 36, penalty: true },
        { team: "away", player: "Mbappé", minute: 75 },
      ]);
    });

    it("handles ownGoal and penalty correctly", () => {
      const raw = [
        {
          team: "home",
          player: "Defensa",
          minute: 12,
          ownGoal: true,
        },
      ];
      expect(sanitizeGoals(raw)).toEqual([
        { team: "home", player: "Defensa", minute: 12, ownGoal: true },
      ]);
    });
  });

  describe("isMatchEqual", () => {
    it("matches by canonicalCompetitionId and canonical team IDs", () => {
      const pm = createMockMatch();
      const em = {
        canonicalCompetitionId: "primera-division",
        canonicalHomeTeamId: "valencia",
        canonicalAwayTeamId: "real-madrid",
        estado: "FINISHED" as const,
      };
      expect(isMatchEqual(pm, em)).toBe(true);
    });

    // SPEC-070: this case fixed the permissive pairing by similar names
    // (shared tokens); now names pair only through the rfef alias.
    it("does not match by similar names when no alias or id resolves them", () => {
      const pm = createMockMatch();
      const em = {
        canonicalCompetitionId: "primera-division",
        equipoLocal: "Valencia Club de Fútbol",
        equipoVisitante: "Real Madrid",
        estado: "FINISHED" as const,
      };
      expect(isMatchEqual(pm, em)).toBe(false);
    });

    it("rejects when competition differs", () => {
      const pm = createMockMatch();
      const em = {
        canonicalCompetitionId: "segunda-division",
        canonicalHomeTeamId: "valencia",
        canonicalAwayTeamId: "real-madrid",
        estado: "FINISHED" as const,
      };
      expect(isMatchEqual(pm, em)).toBe(false);
    });

    it("rejects when teams do not match", () => {
      const pm = createMockMatch();
      const em = {
        canonicalCompetitionId: "primera-division",
        canonicalHomeTeamId: "celta",
        canonicalAwayTeamId: "deportivo",
        estado: "FINISHED" as const,
      };
      expect(isMatchEqual(pm, em)).toBe(false);
    });
  });

  describe("enrichMatchesWithGoals", () => {
    it("enriches match with valid goals from Explorer", async () => {
      const match = createMockMatch();
      const mockFetcher = vi.fn().mockResolvedValue({
        date: "2026-11-07",
        exportedAt: "2026-11-07T22:30:00Z",
        matches: [
          {
            canonicalCompetitionId: "primera-division",
            canonicalHomeTeamId: "valencia",
            canonicalAwayTeamId: "real-madrid",
            estado: "FINISHED",
            goals: [
              { team: "away", player: "Valverde", minute: 28 },
              { team: "away", player: "Güler", minute: 36 },
              { team: "away", player: "Mbappé", minute: 75 },
            ],
          },
        ],
      });

      const enriched = await enrichMatchesWithGoals([match], mockFetcher);
      expect(mockFetcher).toHaveBeenCalledWith("2026-11-07");
      expect(enriched[0]?.goals).toEqual([
        { team: "away", player: "Valverde", minute: 28 },
        { team: "away", player: "Güler", minute: 36 },
        { team: "away", player: "Mbappé", minute: 75 },
      ]);
    });

    it("preserves existing goals if already populated", async () => {
      const existingGoals = [
        { team: "home" as const, player: "Ainhoa", minute: 44 },
      ];
      const match = createMockMatch({ goals: existingGoals });
      const mockFetcher = vi.fn();

      const enriched = await enrichMatchesWithGoals([match], mockFetcher);
      expect(mockFetcher).not.toHaveBeenCalled();
      expect(enriched[0]?.goals).toBe(existingGoals);
    });

    it("skips scheduled matches with 0-0 or null score", async () => {
      const match = createMockMatch({
        status: "scheduled",
        score: null,
      });
      const mockFetcher = vi.fn();

      const enriched = await enrichMatchesWithGoals([match], mockFetcher);
      expect(mockFetcher).not.toHaveBeenCalled();
      expect(enriched[0]?.goals).toBeUndefined();
    });

    it("leaves goals undefined if Explorer only returns synthetic placeholders", async () => {
      const match = createMockMatch();
      const mockFetcher = vi.fn().mockResolvedValue({
        date: "2026-11-07",
        exportedAt: "2026-11-07T22:30:00Z",
        matches: [
          {
            canonicalCompetitionId: "primera-division",
            canonicalHomeTeamId: "valencia",
            canonicalAwayTeamId: "real-madrid",
            estado: "FINISHED",
            goals: [{ team: "away", player: "Goleador Visitante", minute: 0 }],
          },
        ],
      });

      const enriched = await enrichMatchesWithGoals([match], mockFetcher);
      expect(enriched[0]?.goals).toBeUndefined();
    });

    it("handles network failure gracefully without throwing", async () => {
      const match = createMockMatch();
      const mockFetcher = vi
        .fn()
        .mockRejectedValue(new Error("Network timeout"));

      const enriched = await enrichMatchesWithGoals([match], mockFetcher);
      expect(enriched[0]?.goals).toBeUndefined();
      expect(enriched[0]?.matchId).toBe(match.matchId);
    });

    it("returns the matches intact when Explorer never answers (CA-4 timeout)", async () => {
      vi.useFakeTimers();
      try {
        const match = createMockMatch();
        const neverAnswers = vi.fn(
          () => new Promise<never>(() => {}),
        ) as unknown as (date: string) => Promise<DayMatchesResponse>;

        let settled = false;
        const pending = enrichMatchesWithGoals([match], neverAnswers).then(
          (r) => {
            settled = true;
            return r;
          },
        );

        await vi.advanceTimersByTimeAsync(EXPLORER_ENRICHMENT_TIMEOUT_MS - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        const enriched = await pending;

        expect(settled).toBe(true);
        expect(enriched).toEqual([match]);
        expect(enriched[0]?.goals).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("honours an injected timeout for a fetcher that never answers (CA-4)", async () => {
      const match = createMockMatch();
      const neverAnswers = () => new Promise<DayMatchesResponse>(() => {});
      const started = Date.now();
      const enriched = await enrichMatchesWithGoals(
        [match],
        neverAnswers,
        null,
        { timeoutMs: 20 },
      );
      expect(Date.now() - started).toBeLessThan(1000);
      expect(enriched).toEqual([match]);
    });

    it("keeps the enrichment timeout short enough not to delay the front page", () => {
      expect(EXPLORER_ENRICHMENT_TIMEOUT_MS).toBeGreaterThan(0);
      expect(EXPLORER_ENRICHMENT_TIMEOUT_MS).toBeLessThanOrEqual(3000);
    });

    it("only adds goals: certified fields stay untouched (CA-3)", async () => {
      const match = createMockMatch({
        status: "live",
        score: { home: 1, away: 2 },
        minute: 67,
        halfTime: false,
        homeScoredAt: "2026-11-07T20:20:00.000Z" as Instant,
        awayScoredAt: "2026-11-07T21:05:00.000Z" as Instant,
      } as Partial<PublicMatch>);
      const before = structuredClone(match);
      const mockFetcher = vi.fn().mockResolvedValue({
        date: "2026-11-07",
        exportedAt: "2026-11-07T22:30:00Z",
        matches: [
          {
            canonicalCompetitionId: "primera-division",
            canonicalHomeTeamId: "valencia",
            canonicalAwayTeamId: "real-madrid",
            estado: "FINISHED",
            homeScore: 9,
            awayScore: 9,
            minute: 90,
            halfTime: true,
            goals: [
              { team: "home", player: "Hugo Duro", minute: 20 },
              { team: "away", player: "Mbappé", minute: 50 },
            ],
          },
        ],
      });

      const [enriched] = await enrichMatchesWithGoals([match], mockFetcher);
      expect(enriched?.goals).toHaveLength(2);
      const { goals: _goals, ...rest } = enriched as PublicMatch;
      expect(rest).toEqual(before);
      expect(match).toEqual(before);
    });

    it("handles empty matches array", async () => {
      const enriched = await enrichMatchesWithGoals([]);
      expect(enriched).toEqual([]);
    });

    it("converts UTC kickoff to Europe/Madrid date when querying Explorer", async () => {
      const match = createMockMatch({
        kickoff: "2026-11-08T23:30:00.000Z" as Instant,
      });
      const mockFetcher = vi.fn().mockResolvedValue({
        date: "2026-11-09",
        exportedAt: "2026-11-09T00:00:00Z",
        matches: [],
      });

      await enrichMatchesWithGoals([match], mockFetcher);
      expect(toMadridDate("2026-11-08T23:30:00.000Z")).toBe("2026-11-09");
      expect(mockFetcher).toHaveBeenCalledWith("2026-11-09");
    });
  });
});
