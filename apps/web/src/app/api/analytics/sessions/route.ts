import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { listAnalyticsSessionsResult } from "@/lib/server/analytics-product";

const cacheHeaders = createPublicCacheHeaders({
  browserMaxAgeSeconds: 60,
  edgeMaxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 900,
});

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many Analytics requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const result = await listAnalyticsSessionsResult();
    if (result.mode === "unavailable") {
      return apiError({
        status: 503,
        code: "service_unavailable",
        message: "Analytics product data is unavailable right now.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ sessions: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load Analytics sessions.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
