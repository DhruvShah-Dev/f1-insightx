import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getStrategyLabRaceProduct } from "@/lib/server/strategy-lab-product";

type RouteContext = {
  params: Promise<{
    raceId: string;
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
      message: "Too many Strategy Lab requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const { raceId } = await context.params;

  try {
    const product = await getStrategyLabRaceProduct(raceId);
    if (!product) {
      return apiError({
        status: 404,
        code: "not_found",
        message: "Strategy Lab data was not found for this race.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk(product, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load Strategy Lab data.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}
