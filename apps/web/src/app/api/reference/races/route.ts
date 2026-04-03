import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { racesQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listAvailableSeasons, listRaces } from "@/lib/server/reference-data";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 120, edgeMaxAgeSeconds: 900, staleWhileRevalidateSeconds: 3600 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many race requests. Try again shortly.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
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
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  try {
    const [races, availableSeasons] = await Promise.all([
      listRaces(parsed.data),
      listAvailableSeasons(),
    ]);

    return apiOk({
      items: races,
      count: races.length,
      availableSeasons,
      filters: parsed.data,
    }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load races.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }
}
