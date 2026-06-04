import { apiError, apiOk } from "@/lib/api/errors";
import { fantasyRequestSchema, flattenZodError } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.fantasyValidate);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many validation requests. Try again shortly.",
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

  const normalized = parsed.data;
  const warnings: string[] = [];

  if (normalized.scoringFocus === "differential" && normalized.riskProfile === "safe") {
    warnings.push("Safe risk profile may conflict with a differential-first scoring focus.");
  }

  if (normalized.preferredDriverIds.length === 0 && normalized.preferredConstructorIds.length === 0) {
    warnings.push("No preferred picks were supplied; later recommendations will optimize from the full pool.");
  }

  return apiOk({
    request: normalized,
    warnings,
    message: "Fantasy request contract is valid for the optimization engine.",
  }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
}
