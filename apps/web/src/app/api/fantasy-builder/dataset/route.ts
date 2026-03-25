import { apiError, apiOk } from "@/lib/api/errors";
import { getFantasyDataset } from "@/lib/server/fantasy-data";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = Number(url.searchParams.get("season") ?? "2024");
  const roundParam = url.searchParams.get("round");
  const round = roundParam ? Number(roundParam) : undefined;

  if (Number.isNaN(season) || (round !== undefined && Number.isNaN(round))) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Season and round must be numeric when provided.",
    });
  }

  try {
    const dataset = await getFantasyDataset(season, round);
    return apiOk(dataset);
  } catch (error) {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "Failed to load fantasy dataset.",
    });
  }
}
