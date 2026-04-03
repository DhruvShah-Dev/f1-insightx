import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { referenceQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listCircuits } from "@/lib/server/reference-data";

const cacheHeaders = createPublicCacheHeaders({ browserMaxAgeSeconds: 300, edgeMaxAgeSeconds: 3600, staleWhileRevalidateSeconds: 86400 });

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.publicRead);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many circuit requests. Try again shortly.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = referenceQuerySchema.safeParse(params);

  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Invalid circuits query parameters.",
      details: flattenZodError(parsed.error),
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }

  try {
    const circuits = await listCircuits(parsed.data);
    return apiOk({
      items: circuits,
      count: circuits.length,
      filters: parsed.data,
    }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load circuits.",
      headers: mergeHeaders(cacheHeaders, rateLimit.headers),
    });
  }
}
