import { NextResponse } from "next/server";
import { accountError, accountHeaders } from "@/lib/api/account-responses";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getUserProfileByIdWithClient } from "@/lib/account/profile";
import { getServerEnv } from "@/lib/env";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

export async function POST(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.profileWrite);
  if (!rateLimit.ok) {
    return accountError("Too many export requests. Try again later.", { status: 429, rateLimit });
  }

  const { appUrl } = getServerEnv();
  if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
    return accountError("This request could not be verified.", { status: 403, rateLimit });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return accountError("Sign in to export your account data.", { status: 401, rateLimit });
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return accountError("Sign in to export your account data.", { status: 401, rateLimit });
  }

  const profile = await getUserProfileByIdWithClient(supabase, user.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email ?? "",
      provider:
        typeof user.app_metadata?.provider === "string"
          ? user.app_metadata.provider
          : typeof user.user_metadata?.provider === "string"
            ? user.user_metadata.provider
            : "email",
      createdAt: user.created_at ?? null,
    },
    profile,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...accountHeaders(rateLimit),
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="f1-insightx-account-export.json"',
    },
  });
}
