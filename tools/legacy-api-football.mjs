// Helper de soporte para scripts one-off históricos (SPEC-013, SPEC-018) y herramientas
// que interactuaban con la API directa de API-Football antes de su extracción a Explorer (SPEC-061).

export const apiFootballByIds = async ({
  fixtureIds,
  apiKey,
  userAgent,
  now,
  fetch = globalThis.fetch,
}) => {
  const url = `https://v3.football.api-sports.io/fixtures?ids=${fixtureIds.join("-")}`;
  const response = await fetch(url, {
    headers: { "x-apisports-key": apiKey, "user-agent": userAgent },
  });
  const body = await response.text();
  return {
    sourceId: "api-football",
    capturedAt: now,
    requests: [
      {
        url,
        status: response.status,
        contentType: response.headers.get("content-type") ?? "application/json",
        body,
      },
    ],
  };
};

export const createApiFootballResults = ({ aliases, apiKey }) => ({
  sourceId: "api-football",
  parse: (capture) => {
    const observations = [];
    for (const req of capture.requests) {
      if (!req.body) continue;
      const json = JSON.parse(req.body);
      for (const item of json.response ?? []) {
        const matchId = aliases.matches?.[String(item.fixture?.id)];
        if (matchId) {
          observations.push({
            matchId,
            observedAt: capture.capturedAt,
            status: item.fixture?.status?.short === "FT" ? "finished" : "live",
            score: item.goals,
            period: null,
            minute: item.fixture?.status?.elapsed ?? null,
            extraMinute: null,
          });
        }
      }
    }
    return {
      observations,
      skipped: [],
      unresolved: [],
      requestErrors: [],
    };
  },
});
