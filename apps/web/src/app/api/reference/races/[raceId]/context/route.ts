import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getRaceContextResult } from "@/lib/server/race-context";

type RouteContext = {
  params: Promise<{
    raceId: string;
  }>;
};

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 60, edgeMaxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 });

export async function GET(request: Request, context: RouteContext) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many race context requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const { raceId } = await context.params;

  try {
    const result = await getRaceContextResult(raceId);
    if (result.mode === "unavailable") {
      const looksLikeMissingRace = result.meta.reason?.includes("returned no data") ?? false;
      return apiError({
        status: looksLikeMissingRace ? 404 : 503,
        code: looksLikeMissingRace ? "not_found" : "service_unavailable",
        message: looksLikeMissingRace ? "Race context was not found." : "Race context is unavailable right now.",
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ raceContext: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load race context.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
