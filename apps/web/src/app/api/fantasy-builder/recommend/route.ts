import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { fantasyRequestSchema, flattenZodError } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getFantasyDataset } from "@/lib/server/fantasy-data";
import { optimizeFantasyLineups } from "@/lib/server/fantasy-optimizer";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.fantasyRecommend);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many recommendation requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return apiError({
      status: 400,
      code: "bad_request",
      message: "Request body must be valid JSON.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const parsed = fantasyRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_payload",
      message: "Fantasy lineup request is invalid.",
      details: flattenZodError(parsed.error),
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const dataset = await getFantasyDataset(parsed.data.season, parsed.data.round);
    const recommendations = optimizeFantasyLineups(parsed.data, dataset);
    return apiOk(recommendations, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate fantasy recommendations.";

    if (message.startsWith("No valid lineup fits")) {
      return apiError({
        status: 400,
        code: "bad_request",
        message,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiErrorFrom(error, {
      fallbackMessage: "The lineup engine could not finish this run right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:fantasy-builder:recommend",
      logMetadata: {
        season: parsed.data.season,
        round: parsed.data.round ?? null,
        budget: parsed.data.budget,
        riskProfile: parsed.data.riskProfile,
      },
    });
  }
}
