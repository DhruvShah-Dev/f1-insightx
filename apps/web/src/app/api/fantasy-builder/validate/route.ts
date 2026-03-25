import { apiError, apiOk } from "@/lib/api/errors";
import { fantasyRequestSchema, flattenZodError } from "@/lib/api/validation";

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
  });
}
