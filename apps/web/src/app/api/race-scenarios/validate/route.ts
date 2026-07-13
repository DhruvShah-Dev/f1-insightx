import { apiError, apiOk } from "@/lib/api/errors";
import { flattenZodError, raceScenarioSchema } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { authorizeStrategyLabAccess } from "@/lib/server/strategy-lab-access";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.raceScenarioValidate);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many validation requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const access = await authorizeStrategyLabAccess(request);
  if (!access.ok) {
    return apiError({
      status: 404,
      code: "not_found",
      message: "Strategy Lab data was not found.",
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

  if (normalized.weatherScenario === "dry" && normalized.tirePlan.some((stint) => stint.compound === "soft" && stint.laps > 22)) {
    warnings.push("Long soft-tyre stints can overstate late-stint performance on high-degradation tracks.");
  }

  if (Math.abs(normalized.tyrePressure.frontPsi - normalized.tyrePressure.rearPsi) >= 4) {
    warnings.push("Large front/rear tyre-pressure split increases setup sensitivity in this model.");
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
