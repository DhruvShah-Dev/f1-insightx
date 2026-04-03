import { apiError, apiOk } from "@/lib/api/errors";
import { flattenZodError, raceScenarioSchema } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.raceScenarioValidate);
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

  const parsed = raceScenarioSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_payload",
      message: "Race scenario payload is invalid.",
      details: flattenZodError(parsed.error),
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const normalized = parsed.data;
  const warnings: string[] = [];

  if (normalized.driverIds.length < 5) {
    warnings.push("Fewer than five drivers were provided, so prediction comparisons will be limited.");
  }

  if (normalized.weatherScenario !== "dry" && normalized.tirePlan.some((stint) => stint.compound === "hard")) {
    warnings.push("Wet or mixed scenarios with hard compounds can produce unstable heuristic outputs.");
  }

  if (normalized.qualifyingOverrides.length > 0 && normalized.qualifyingOverrides.length !== normalized.driverIds.length) {
    warnings.push("Only some selected drivers have explicit qualifying overrides; the rest will require fallback assumptions.");
  }

  return apiOk({
    scenario: normalized,
    warnings,
    message: "Race scenario contract is valid for the simulation engine.",
  }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
}
