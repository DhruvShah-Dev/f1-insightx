import { apiOk } from "@/lib/api/errors";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.health);
  if (!rateLimit.ok) {
    return Response.json(
      { ok: false, error: { code: "rate_limited", message: "Too many health requests.", details: null } },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  return apiOk(
    {
      status: "ok",
    },
    { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
  );
}
