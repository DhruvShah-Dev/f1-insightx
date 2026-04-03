import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getFantasyDataset } from "@/lib/server/fantasy-data";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 120, edgeMaxAgeSeconds: 600, staleWhileRevalidateSeconds: 1800 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.fantasyDataset);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many fantasy dataset requests. Try again shortly.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  const url = new URL(request.url);
  const season = Number(url.searchParams.get("season") ?? "2024");
  const roundParam = url.searchParams.get("round");
  const round = roundParam ? Number(roundParam) : undefined;

  if (Number.isNaN(season) || (round !== undefined && Number.isNaN(round))) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Season and round must be numeric when provided.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  try {
    const dataset = await getFantasyDataset(season, round);
    return apiOk(dataset, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load fantasy dataset.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }
}
