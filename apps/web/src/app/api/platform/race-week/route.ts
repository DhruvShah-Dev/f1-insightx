import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getRaceWeekProductResult } from "@/lib/server/race-week-product";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 60, edgeMaxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many requests for race-week data. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const result = await getRaceWeekProductResult();
    if (result.mode === "unavailable") {
      return apiError({
        status: 503,
        code: "service_unavailable",
        message: "Race Week product data is unavailable right now.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ raceWeek: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Race-week data is unavailable right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:platform:race-week",
    });
  }
}
