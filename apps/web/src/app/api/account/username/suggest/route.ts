import { accountError, accountJson } from "@/lib/api/account-responses";
import { getSupabasePrivilegedClient } from "@/lib/server/supabase";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { suggestUniqueUsername } from "@/lib/account/usernames";
import { getServerEnv } from "@/lib/env";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.usernameSuggest);
  if (!rateLimit.ok) {
    return accountError("Too many username suggestions. Try again shortly.", { status: 429, rateLimit });
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return accountError("This request could not be verified.", { status: 403, rateLimit });
  }

  const userClient = await getSupabaseServerClient();
  if (!userClient) {
    return accountError("Sign in to generate usernames.", { status: 401, rateLimit });
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return accountError("Sign in to generate usernames.", { status: 401, rateLimit });
  }

  const supabase = getSupabasePrivilegedClient();
  if (!supabase) {
    return accountError("Username suggestions are unavailable right now.", { status: 503, rateLimit });
  }

  const { searchParams } = new URL(request.url);
  const constructorId = searchParams.get("constructorId") || undefined;
  const driverId = searchParams.get("driverId") || undefined;

  const username = await suggestUniqueUsername(supabase, constructorId, driverId, user.id);
  return accountJson({ username }, { rateLimit });
}
