import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { flattenZodError, raceScenarioSchema } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getRaceContext } from "@/lib/server/race-context";
import { simulateRaceScenario } from "@/lib/server/race-simulator";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.raceScenarioSimulate);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many scenario simulations. Try again shortly.",
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

  try {
    const raceContext = await getRaceContext(parsed.data.raceId);
    if (!raceContext) {
        return apiError({
          status: 404,
          code: "not_found",
          message: "Race context was not found for the requested scenario.",
          headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
        });
      }

    const missingDrivers = parsed.data.driverIds.filter(
      (driverId) => !raceContext.entrants.some((entrant) => entrant.driverId === driverId),
    );

    if (missingDrivers.length > 0) {
        return apiError({
          status: 400,
          code: "bad_request",
          message: "One or more selected drivers are not present in the chosen race context.",
          details: { missingDrivers },
          headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
        });
      }

    return apiOk(simulateRaceScenario(parsed.data, raceContext), { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "The strategy engine could not run that scenario right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:race-scenarios:simulate",
      logMetadata: {
        raceId: parsed.data.raceId,
        weatherScenario: parsed.data.weatherScenario,
        pitStopCount: parsed.data.pitStopCount,
      },
    });
  }
}
