import { apiError, apiErrorFrom, apiOk } from "@/lib/api/errors";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  getAuthProviderLabel,
  getUserProfileByIdWithClient,
  profilePayloadSchema,
  upsertUserProfileWithClient,
  isConstructorOptionValid,
  isDriverOptionValid,
} from "@/lib/account/profile";
import { isUsernameAvailable, validateUsername } from "@/lib/account/usernames";
import { getServerEnv } from "@/lib/env";
import { createAppError } from "@/lib/errors/app-error";
import { NO_STORE_HEADERS, mergeHeaders } from "@/lib/http/headers";
import { isTrustedOrigin } from "@/lib/security/request";
import { checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rate-limit";
import { getSupabasePrivilegedClient } from "@/lib/server/supabase";

async function verifyProfileReferenceData(
  supabaseAdmin: NonNullable<ReturnType<typeof getSupabasePrivilegedClient>>,
  constructorId?: string | null,
  driverId?: string | null,
) {
  if (!constructorId && !driverId) {
    return;
  }

  const [{ data: constructors, error: constructorError }, { data: drivers, error: driverError }] = await Promise.all([
    constructorId ? supabaseAdmin.from("constructors").select("id").eq("id", constructorId).limit(1) : Promise.resolve({ data: [{ id: null }], error: null }),
    driverId ? supabaseAdmin.from("drivers").select("id").eq("id", driverId).limit(1) : Promise.resolve({ data: [{ id: null }], error: null }),
  ]);

  if (constructorError || driverError) {
    throw createAppError({
      kind: "external",
      code: "service_unavailable",
      status: 503,
      message: `Failed to verify profile reference data: ${constructorError?.message ?? driverError?.message ?? "unknown error"}`,
      userMessage: "Profile setup could not be completed right now.",
      cause: constructorError ?? driverError ?? undefined,
    });
  }

  if ((constructorId && !constructors?.length) || (driverId && !drivers?.length)) {
    throw createAppError({
      kind: "config",
      code: "config_error",
      status: 503,
      message: `Profile reference data is missing in Supabase for constructor "${constructorId}" and/or driver "${driverId}".`,
      userMessage: "Profile setup is temporarily unavailable. Try again shortly.",
    });
  }
}

async function getAuthenticatedUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { supabase: null, user: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw createAppError({
      kind: "auth",
      code: "auth_error",
      status: 503,
      message: `Failed to load authenticated user: ${error.message}`,
      userMessage: "Your account session could not be verified right now.",
      cause: error,
    });
  }

  return { supabase, user };
}

export async function GET(request: Request) {
  try {
    const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.profileRead);
    if (!rateLimit.ok) {
      return apiError({
        status: 429,
        code: "rate_limited",
        message: "Too many profile requests. Try again shortly.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const { supabase, user } = await getAuthenticatedUser();
    if (!supabase || !user) {
      return apiError({
        status: 401,
        code: "unauthorized",
        message: "Sign in to view your profile.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const profile = await getUserProfileByIdWithClient(supabase, user.id);

    return apiOk({
      user: {
        id: user.id,
        email: user.email ?? "",
        provider: getAuthProviderLabel(user),
      },
      profile,
    }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Unable to load your profile right now.",
      headers: NO_STORE_HEADERS,
      logContext: "api:account-profile:get",
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const rateLimit = await checkRateLimitAsync(request, RATE_LIMIT_POLICIES.profileWrite);
    if (!rateLimit.ok) {
      return apiError({
        status: 429,
        code: "rate_limited",
        message: "Too many profile updates. Try again later.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const { appUrl } = getServerEnv();
    if (!isTrustedOrigin(request, appUrl, { allowMissingHeaders: false })) {
      return apiError({
        status: 403,
        code: "forbidden",
        message: "This request could not be verified.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const { supabase, user } = await getAuthenticatedUser();
    if (!supabase || !user) {
      return apiError({
        status: 401,
        code: "unauthorized",
        message: "Sign in to save profile changes.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const supabaseAdmin = getSupabasePrivilegedClient();
    if (!supabaseAdmin) {
      return apiError({
        status: 503,
        code: "config_error",
        message: "Profile saving is unavailable right now.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = profilePayloadSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid profile payload.";
      return apiError({
        status: 400,
        code: "validation_error",
        message: firstError,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    if (parsed.data.favoriteConstructorId && !isConstructorOptionValid(parsed.data.favoriteConstructorId)) {
      return apiError({
        status: 400,
        code: "validation_error",
        message: "Choose a valid constructor.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    if (parsed.data.favoriteDriverId && !isDriverOptionValid(parsed.data.favoriteDriverId)) {
      return apiError({
        status: 400,
        code: "validation_error",
        message: "Choose a valid driver.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const usernameValidation = validateUsername(parsed.data.username);
    if (!usernameValidation.ok) {
      return apiError({
        status: 400,
        code: "validation_error",
        message: usernameValidation.message,
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    const available = await isUsernameAvailable(supabaseAdmin, usernameValidation.normalized, user.id);
    if (!available) {
      return apiError({
        status: 409,
        code: "validation_error",
        message: "That username is already taken.",
        headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers),
      });
    }

    await verifyProfileReferenceData(supabaseAdmin, parsed.data.favoriteConstructorId, parsed.data.favoriteDriverId);

    const profile = await upsertUserProfileWithClient(supabase, user.id, {
      username: usernameValidation.normalized,
      favoriteConstructorId: parsed.data.favoriteConstructorId,
      favoriteDriverId: parsed.data.favoriteDriverId,
      avatarType: parsed.data.avatarType,
      confirmCustomUsernameChange: parsed.data.confirmCustomUsernameChange,
      onboardingCompleted: Boolean(parsed.data.favoriteConstructorId && parsed.data.favoriteDriverId),
    });

    return apiOk({
      user: {
        id: user.id,
        email: user.email ?? "",
        provider: getAuthProviderLabel(user),
      },
      profile,
    }, { headers: mergeHeaders(NO_STORE_HEADERS, rateLimit.headers) });
  } catch (error) {
    return apiErrorFrom(error, {
      fallbackMessage: "Unable to save your profile right now.",
      headers: NO_STORE_HEADERS,
      logContext: "api:account-profile:patch",
    });
  }
}
