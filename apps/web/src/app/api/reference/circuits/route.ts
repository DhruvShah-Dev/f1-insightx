import { apiError, apiOk } from "@/lib/api/errors";
import { referenceQuerySchema, flattenZodError } from "@/lib/api/validation";
import { listCircuits } from "@/lib/server/reference-data";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = referenceQuerySchema.safeParse(params);

  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_query",
      message: "Invalid circuits query parameters.",
      details: flattenZodError(parsed.error),
    });
  }

  try {
    const circuits = await listCircuits(parsed.data);
    return apiOk({
      items: circuits,
      count: circuits.length,
      filters: parsed.data,
    });
  } catch (error) {
    return apiError({
      status: 500,
      code: "upstream_error",
      message: error instanceof Error ? error.message : "Failed to load circuits.",
    });
  }
}
