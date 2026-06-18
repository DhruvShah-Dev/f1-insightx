import { accountError, accountJson } from "@/lib/api/account-responses";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.signOut);
  if (!rateLimit.ok) {
    return accountError("Too many sign-out requests. Try again shortly.", { status: 429, rateLimit });
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return accountError("Forbidden", { status: 403, rateLimit });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return accountError("Authentication is unavailable right now.", { status: 503, rateLimit });
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return accountError("Unable to sign out right now.", { status: 400, rateLimit });
  }

  const redirectTo = new URL(request.url);
  redirectTo.pathname = "/account";
  redirectTo.search = "";

  return accountJson({ ok: true, redirectTo: redirectTo.toString() }, { rateLimit });
}
