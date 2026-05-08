import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getAnalyticsComparisonResult, validateAnalyticsCompareParams } from "@/lib/server/analytics-product";

const cacheHeaders = createPublicCacheHeaders({
  browserMaxAgeSeconds: 30,
  edgeMaxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 900,
});

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.analyticsCompare);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many Analytics requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const url = new URL(request.url);
  const validation = validateAnalyticsCompareParams({
    sessionId: url.searchParams.get("sessionId"),
    driverA: url.searchParams.get("driverA"),
    driverB: url.searchParams.get("driverB"),
    mode: url.searchParams.get("mode"),
  });

  if (!validation.ok) {
    return apiError({
      status: validation.status,
      code: validation.code,
      message: validation.message,
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const { sessionId, driverA, driverB, mode } = validation.value;
    const result = await getAnalyticsComparisonResult(sessionId, driverA, driverB, mode);
    if (result.mode === "unavailable") {
      return apiError({
        status: 404,
        code: "not_found",
        message: "No Analytics comparison is available for that session and driver pair.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ comparison: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load Analytics comparison.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
