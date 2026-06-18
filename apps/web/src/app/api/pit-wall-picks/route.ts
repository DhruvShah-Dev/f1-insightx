import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { mergeHeaders, NO_STORE_HEADERS } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getPitWallPicksPayload } from "@/lib/server/pit-wall-picks";

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

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.publicRead, userId ?? undefined);
  if (!rateLimit.ok) {
    return apiError({
      status: 429,
      code: "rate_limited",
      message: "Too many Picks requests. Try again shortly.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  try {
    const payload = await getPitWallPicksPayload(userId);
    return apiOk(payload, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Picks are unavailable right now.",
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      logContext: "api:pit-wall-picks:get",
    });
  }
}
