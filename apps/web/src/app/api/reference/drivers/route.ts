import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { referenceQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listDrivers } from "@/lib/server/reference-data";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 300, edgeMaxAgeSeconds: 3600, staleWhileRevalidateSeconds: 86400 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many driver requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = referenceQuerySchema.safeParse(params);

  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Invalid drivers query parameters.",
      details: flattenZodError(parsed.error),
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const drivers = await listDrivers(parsed.data);
    return apiOk({
      items: drivers,
      count: drivers.length,
      filters: parsed.data,
    }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load drivers.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
