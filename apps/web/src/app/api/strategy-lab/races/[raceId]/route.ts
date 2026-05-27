import { apiError, apiOk } from "@/lib/api/errors";
import { createPublicCacheHeaders, mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getStrategyLabRaceProductResult } from "@/lib/server/strategy-lab-product";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import { classifyStrategyLabUnavailable } from "./response";

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

type StrategyLabRouteResult = {
  mode: "primary" | "degraded";
  data: NonNullable<Awaited<ReturnType<typeof getStrategyLabRaceProductResult>>["data"]>;
  meta: RuntimeSourceMetadata;
} | {
  mode: "unavailable";
  data: null;
  meta: RuntimeSourceMetadata;
};

export async function handleStrategyLabRaceGet(
  request: Request,
  context: RouteContext,
  deps: {
    getRaceProductResult?: (raceId: string) => Promise<StrategyLabRouteResult>;
  } = {},
) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.publicRead);
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
    const result = await (deps.getRaceProductResult ?? getStrategyLabRaceProductResult)(raceId);
    if (result.mode === "unavailable") {
      const unavailable = classifyStrategyLabUnavailable(result.meta);
      return apiError({
        status: unavailable.status,
        code: unavailable.code,
        message: unavailable.message,
        details: result.meta,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ product: result.data, runtime: result.meta }, { headers: mergeHeaders(cacheHeaders, rateLimit.headers) });
  } catch {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: "Failed to load Strategy Lab data.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleStrategyLabRaceGet(request, context);
}
