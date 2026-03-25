import { apiError, apiOk } from "@/lib/api/errors";
import { racesQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listAvailableSeasons, listRaces } from "@/lib/server/reference-data";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = racesQuerySchema.safeParse(params);

  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Invalid races query parameters.",
      details: flattenZodError(parsed.error),
    });
  }

  try {
    const [races, availableSeasons] = await Promise.all([
      listRaces(parsed.data),
      listAvailableSeasons(),
    ]);

    return apiOk({
      items: races,
      count: races.length,
      availableSeasons,
      filters: parsed.data,
    });
  } catch (error) {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "Failed to load races.",
    });
  }
}
