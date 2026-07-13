import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { flattenZodError, raceScenarioSchema } from "@/lib/api/validation";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { authorizeStrategyLabAccess } from "@/lib/server/strategy-lab-access";
import { getStrategyLabRaceProduct } from "@/lib/server/strategy-lab-product";
import { simulateRaceScenario } from "@/lib/server/strategy-lab-simulator";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.raceScenarioSimulate);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many scenario simulations. Try again shortly.",
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

  if (access.method !== "token") {
    const userClient = await getSupabaseServerClient();
    if (!userClient) {
      return apiError({
        status: 401,
        code: "unauthorized",
        message: "Sign in to run race strategy simulations.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return apiError({
        status: 401,
        code: "unauthorized",
        message: "Sign in to run race strategy simulations.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }
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
    const raceProduct = await getStrategyLabRaceProduct(parsed.data.raceId);
    if (!raceProduct) {
        return apiError({
          status: 404,
          code: "not_found",
          message: "Strategy Lab data was not found for the requested scenario.",
          headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
        });
      }

    const missingDrivers = parsed.data.driverIds.filter(
      (driverId) => !raceProduct.entrants.some((entrant) => entrant.driverId === driverId),
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

    return apiOk(simulateRaceScenario(parsed.data, raceProduct), {
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
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
