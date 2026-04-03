import { apiOk } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.health);
  if (!rateLimit.ok) {
    return Response.json(
      { ok: false, error: { code: "rate_limited", message: "Too many health requests.", details: null } },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const env = getServerEnv();

  return apiOk({
    status: "ok",
    mode: env.hasSupabaseAdmin ? "supabase" : "local-curated-csv",
  }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
}
