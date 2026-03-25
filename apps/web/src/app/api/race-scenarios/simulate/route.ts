import { apiError, apiOk } from "@/lib/api/errors";
import { flattenZodError, raceScenarioSchema } from "@/lib/api/validation";
import { getRaceContext } from "@/lib/server/race-context";
import { simulateRaceScenario } from "@/lib/server/race-simulator";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return apiError({
      status: 400,
      code: "bad_request",
      message: "Request body must be valid JSON.",
    });
  }

  const parsed = raceScenarioSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_payload",
      message: "Race scenario payload is invalid.",
      details: flattenZodError(parsed.error),
    });
  }

  try {
    const raceContext = await getRaceContext(parsed.data.raceId);
    if (!raceContext) {
      return apiError({
        status: 404,
        code: "not_found",
        message: "Race context was not found for the requested scenario.",
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
      });
    }

    return apiOk(simulateRaceScenario(parsed.data, raceContext));
  } catch (error) {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "Failed to simulate race scenario.",
    });
  }
}
