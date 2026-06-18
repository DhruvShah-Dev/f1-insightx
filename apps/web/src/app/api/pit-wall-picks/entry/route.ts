import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { pitWallPickPayloadSchema } from "@/lib/pit-wall-picks/scoring";
import { isTrustedOrigin } from "@/lib/security/request";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { savePitWallPicksEntry } from "@/lib/server/pit-wall-picks";

async function getAuthenticatedUserId() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.profileWrite, userId ?? undefined);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many Picks saves. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  if (!userId) {
    return apiError({
      status: 401,
      code: "unauthorized",
      message: "Sign in to save Picks.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return apiError({
      status: 403,
      code: "forbidden",
      message: "This request could not be verified.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const body = await request.json().catch(() => null);
  const parsed = pitWallPickPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError({
      status: 400,
      code: "invalid_payload",
      message: parsed.error.issues[0]?.message ?? "Picks payload is invalid.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const result = await savePitWallPicksEntry(userId, parsed.data);
    if (!result.ok) {
      return apiError({
        status: result.status,
        code: result.status === 409 ? "validation_error" : result.status === 404 ? "not_found" : result.status === 503 ? "config_error" : "bad_request",
        message: result.message,
        details: "details" in result ? result.details : null,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    return apiOk({ pick: result.pick }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Your picks could not be saved right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:pit-wall-picks:put",
    });
  }
}
