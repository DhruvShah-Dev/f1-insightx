import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { isUsernameAvailable, validateUsername } from "@/lib/account/usernames";
import { getServerEnv } from "@/lib/env";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { isTrustedOrigin } from "@/lib/security/request";

const querySchema = z.object({
  username: z.string().trim().min(1),
  excludeUserId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.usernameCheck);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many username checks. Try again in a minute." },
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
      { error: "Sign in to check usernames." },
      { status: 401, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to check usernames." },
      { status: 401, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Username checks are unavailable right now." },
      { status: 503, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    username: url.searchParams.get("username") ?? "",
    excludeUserId: user.id,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a username to check." },
      { status: 400, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const validation = validateUsername(parsed.data.username);
  if (!validation.ok) {
    return NextResponse.json(
      { available: false, error: "That username cannot be used." },
      { status: 400, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const available = await isUsernameAvailable(supabase, validation.normalized, parsed.data.excludeUserId);
  return NextResponse.json(
    { available, username: validation.normalized },
    { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
  );
}
