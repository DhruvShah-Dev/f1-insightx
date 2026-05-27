import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getSupabasePublicClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function heartbeatPayload(ok: boolean, extra?: Record<string, unknown>) {
  return {
    ok,
    source: "supabase",
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.health);
  const headers = mergeHeaders(NO_STORE_HEADERS, rateLimit.headers);

  if (!rateLimit.ok) {
    return Response.json(
      heartbeatPayload(false, {
        error: {
          code: "rate_limited",
          message: "Too many heartbeat requests.",
        },
      }),
      { status: 429, headers },
    );
  }

  const supabase = getSupabasePublicClient();
  if (!supabase) {
    return Response.json(
      heartbeatPayload(false, {
        error: {
          code: "supabase_not_configured",
          message: "Supabase public client is not configured.",
        },
      }),
      { status: 503, headers },
    );
  }

  const { error } = await supabase.from("races").select("id").limit(1);
  if (error) {
    return Response.json(
      heartbeatPayload(false, {
        error: {
          code: "supabase_unavailable",
          message: "Supabase heartbeat query failed.",
        },
      }),
      { status: 503, headers },
    );
  }

  return Response.json(heartbeatPayload(true), { status: 200, headers });
}
