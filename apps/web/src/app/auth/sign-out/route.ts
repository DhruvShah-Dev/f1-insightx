import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.signOut);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many sign-out requests. Try again shortly." },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: "Unable to sign out right now." }, { status: 400, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  }

  const redirectTo = new URL(request.url);
  redirectTo.pathname = "/account";
  redirectTo.search = "";

  return NextResponse.json(
    { ok: true, redirectTo: redirectTo.toString() },
    { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
  );
}
