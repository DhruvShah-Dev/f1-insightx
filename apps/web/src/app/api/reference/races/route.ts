import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { racesQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listAvailableSeasonsResult, listRacesResult } from "@/lib/server/reference-data";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 120, edgeMaxAgeSeconds: 900, staleWhileRevalidateSeconds: 3600 });

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many race requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = racesQuerySchema.safeParse(params);

  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Invalid races query parameters.",
      details: flattenZodError(parsed.error),
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const [racesResult, seasonsResult] = await Promise.all([
      listRacesResult(parsed.data),
      listAvailableSeasonsResult(),
    ]);

    if (racesResult.mode === "unavailable" || seasonsResult.mode === "unavailable") {
      return apiError({
        status: 503,
        code: "service_unavailable",
        message: "Race reference data is unavailable right now.",
        details: racesResult.mode === "unavailable" ? racesResult.meta : seasonsResult.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const races = racesResult.data;
    const availableSeasons = seasonsResult.data;

    return apiOk({
      items: races,
      count: races.length,
      availableSeasons,
      filters: parsed.data,
      runtime: racesResult.meta,
    }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load races.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
