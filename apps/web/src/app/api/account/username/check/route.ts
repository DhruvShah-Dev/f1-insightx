import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase";
import { isUsernameAvailable, validateUsername } from "@/lib/account/usernames";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";

const querySchema = z.object({
  username: z.string().trim().min(1),
  excludeUserId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(request, RATE_LIMIT_POLICIES.usernameCheck);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many username checks. Try again in a minute." },
      { status: 429, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Username checks are not configured." },
      { status: 503, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    username: url.searchParams.get("username") ?? "",
    excludeUserId: url.searchParams.get("excludeUserId") ?? undefined,
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
      { available: false, error: validation.message },
      { status: 400, headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
    );
  }

  const available = await isUsernameAvailable(supabase, validation.normalized, parsed.data.excludeUserId);
  return NextResponse.json(
    { available, username: validation.normalized },
    { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) },
  );
}
