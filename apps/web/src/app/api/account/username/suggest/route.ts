import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { suggestUniqueUsername } from "@/lib/account/usernames";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.usernameSuggest);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many username suggestions. Try again shortly." },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Username suggestions are not configured." },
      { status: 503, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const { searchParams } = new URL(request.url);
  const constructorId = searchParams.get("constructorId") || undefined;
  const driverId = searchParams.get("driverId") || undefined;
  const excludeUserId = searchParams.get("excludeUserId") ?? undefined;

  const username = await suggestUniqueUsername(supabase, constructorId, driverId, excludeUserId);
  return NextResponse.json({ username }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
}
