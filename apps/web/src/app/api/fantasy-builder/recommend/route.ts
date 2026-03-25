import { apiError, apiOk } from "@/lib/api/errors";
import { fantasyRequestSchema, flattenZodError } from "@/lib/api/validation";
import { getFantasyDataset } from "@/lib/server/fantasy-data";
import { optimizeFantasyLineups } from "@/lib/server/fantasy-optimizer";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return apiError({
      status: 400,
      code: "bad_request",
      message: "Request body must be valid JSON.",
    });
  }

  const parsed = fantasyRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_payload",
      message: "Fantasy lineup request is invalid.",
      details: flattenZodError(parsed.error),
    });
  }

  try {
    const dataset = await getFantasyDataset(parsed.data.season, parsed.data.round);
    const recommendations = optimizeFantasyLineups(parsed.data, dataset);
    return apiOk(recommendations);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate fantasy recommendations.";

    return apiError({
      status: message.startsWith("No valid lineup fits") ? 400 : 500,
      code: message.startsWith("No valid lineup fits") ? "bad_request" : "upstream_error",
      message,
    });
  }
}
