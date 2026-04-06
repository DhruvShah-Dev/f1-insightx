import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { ensureProfileFromUserMetadata } from "@/lib/account/profile";
import { sanitizeInternalRedirectPath } from "@/lib/auth/navigation";
import { logServerError } from "@/lib/errors/logger";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

function applyResponseHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

export async function GET(request: Request) {
  const { supabaseUrl, supabaseAnonKey, hasSupabaseAuth, hasSupabaseAdmin, appUrl } = getServerEnv();
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.authCallback);
  if (!rateLimit.ok) {
    return NextResponse.redirect(new URL("/account?error=too-many-auth-attempts", request.url), {
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  if (!hasSupabaseAuth || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/account?error=supabase-auth-not-configured", request.url), {
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeInternalRedirectPath(requestUrl.searchParams.get("next"), "/account");

  if (!code) {
    return NextResponse.redirect(new URL("/account?error=missing-auth-code", request.url), {
      headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
    });
  }

  const cookieStore = await cookies();
  const redirectBase = appUrl || requestUrl.origin;
  const response = NextResponse.redirect(new URL(next, redirectBase));
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logServerError("auth:callback:exchange-code", error, { next });
    response.headers.set("location", new URL("/account?error=auth-callback-failed", request.url).toString());
    applyResponseHeaders(response, mergeHeaders(NO_STORE_HEADERS, rateLimit.headers));
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && hasSupabaseAdmin) {
    try {
      await ensureProfileFromUserMetadata(user);
    } catch (error) {
      logServerError("auth:callback:profile-bootstrap", error, { userId: user.id });
      response.headers.set("location", new URL("/account?error=profile-bootstrap-failed", request.url).toString());
      applyResponseHeaders(response, mergeHeaders(NO_STORE_HEADERS, rateLimit.headers));
      return response;
    }
  }

  applyResponseHeaders(response, mergeHeaders(NO_STORE_HEADERS, rateLimit.headers));
  return response;
}
