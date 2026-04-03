import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getRaceWeekOverview } from "@/lib/server/f1-platform";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 60, edgeMaxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many requests for race-week data. Try again shortly.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  try {
    const overview = await getRaceWeekOverview();
    return apiOk({ overview }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Race-week data is unavailable right now.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
      logContext: "api:platform:race-week",
    });
  }
}
