import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getAnalyticsDriversResult } from "@/lib/server/analytics-product";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const cacheHeaders = createPublicCacheHeaders({
  browserMaxAgeSeconds: 60,
  edgeMaxAgeSeconds: 300,
  staleWhileRevalidateSeconds: 900,
});

export async function GET(request: Request, context: RouteContext) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many Analytics requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const { sessionId } = await context.params;
  const decodedSessionId = decodeURIComponent(sessionId).trim();

  if (!decodedSessionId) {
    return apiError({
      status: 400,
      code: "bad_request",
      message: "sessionId is required.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const result = await getAnalyticsDriversResult(decodedSessionId);
    if (result.mode === "unavailable") {
      return apiError({
        status: 404,
        code: "not_found",
        message: "No Analytics drivers are available for this session.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ drivers: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load Analytics drivers.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
