import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { suggestUniqueUsername } from "@/lib/account/usernames";
import { getServerEnv } from "@/lib/env";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.usernameSuggest);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many username suggestions. Try again shortly." },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const userClient = await getSupabaseServerClient();
  if (!userClient) {
    return NextResponse.json(
      { error: "Sign in to generate usernames." },
      { status: 401, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to generate usernames." },
      { status: 401, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Username suggestions are unavailable right now." },
      { status: 503, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const { searchParams } = new URL(request.url);
  const constructorId = searchParams.get("constructorId") || undefined;
  const driverId = searchParams.get("driverId") || undefined;

  const username = await suggestUniqueUsername(supabase, constructorId, driverId, user.id);
  return NextResponse.json({ username }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
}
