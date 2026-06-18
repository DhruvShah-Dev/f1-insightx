import { z } from "zod";
import { accountError, accountJson } from "@/lib/api/account-responses";
import { getSupabasePrivilegedClient } from "@/lib/server/supabase";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isUsernameAvailable, validateUsername } from "@/lib/account/usernames";
import { getServerEnv } from "@/lib/env";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

const querySchema = z.object({
  username: z.string().trim().min(1),
  excludeUserId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.usernameCheck);
  if (!rateLimit.ok) {
    return accountError("Too many username checks. Try again in a minute.", { status: 429, rateLimit });
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return accountError("This request could not be verified.", { status: 403, rateLimit });
  }

  const userClient = await getSupabaseServerClient();
  if (!userClient) {
    return accountError("Sign in to check usernames.", { status: 401, rateLimit });
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return accountError("Sign in to check usernames.", { status: 401, rateLimit });
  }

  const supabase = getSupabasePrivilegedClient();
  if (!supabase) {
    return accountError("Username checks are unavailable right now.", { status: 503, rateLimit });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    username: url.searchParams.get("username") ?? "",
    excludeUserId: user.id,
  });

  if (!parsed.success) {
    return accountError("Provide a username to check.", { status: 400, rateLimit });
  }

  const validation = validateUsername(parsed.data.username);
  if (!validation.ok) {
    return accountJson({ available: false, error: "That username cannot be used." }, { status: 400, rateLimit });
  }

  const available = await isUsernameAvailable(supabase, validation.normalized, parsed.data.excludeUserId);
  return accountJson({ available, username: validation.normalized }, { rateLimit });
}
