import { apiError, apiOk } from "@/lib/api/errors";
import { getRaceContext } from "@/lib/server/race-context";

type RouteContext = {
  params: Promise<{
    raceId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { raceId } = await context.params;

  try {
    const raceContext = await getRaceContext(raceId);
    if (!raceContext) {
      return apiError({
        status: 404,
        code: "not_found",
        message: "Race context was not found.",
      });
    }

    return apiOk(raceContext);
  } catch (error) {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "Failed to load race context.",
    });
  }
}
