import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getUpcomingRacePredictionResult } from "@/lib/server/f1-platform";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 60, edgeMaxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many prediction requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const result = await getUpcomingRacePredictionResult();
    if (result.mode === "unavailable") {
      return apiError({
        status: 503,
        code: "service_unavailable",
        message: "Prediction data is unavailable right now.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ prediction: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Prediction data is unavailable right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:predictions:upcoming",
    });
  }
}
