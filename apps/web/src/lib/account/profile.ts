import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { ACCOUNT_CONSTRUCTOR_OPTIONS, ACCOUNT_DRIVER_OPTIONS } from "@/lib/account/options";
import {
  classifyUsernameIntent,
  getUsernameLockWindow,
  isUsernameLocked,
  suggestUniqueUsername,
  validateUsername,
} from "@/lib/account/usernames";
import { createAppError } from "@/lib/errors/app-error";
import { getSupabaseAdminClient } from "@/lib/server/supabase";

export const avatarTypeSchema = z.enum(["constructor_logo", "driver_image"]);
export const PROFILE_LOCK_DAYS = 7;
const PROFILE_LOCK_MS = PROFILE_LOCK_DAYS * 24 * 60 * 60 * 1000;

const favoriteSelectionSchema = z.string().trim().optional().transform((value) => value || null);

export const profilePayloadSchema = z.object({
  username: z.string().trim().min(1),
  favoriteConstructorId: favoriteSelectionSchema,
  favoriteDriverId: favoriteSelectionSchema,
  avatarType: avatarTypeSchema,
  confirmCustomUsernameChange: z.boolean().optional().default(false),
}).superRefine((value, ctx) => {
  const usernameValidation = validateUsername(value.username);
  if (!usernameValidation.ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["username"],
      message: usernameValidation.message,
    });
  }

  if (value.favoriteConstructorId && !isConstructorOptionValid(value.favoriteConstructorId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["favoriteConstructorId"],
      message: "Choose a valid constructor from the current field.",
    });
  }

  if (value.favoriteDriverId && !isDriverOptionValid(value.favoriteDriverId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["favoriteDriverId"],
      message: "Choose a valid driver from the current field.",
    });
  }
});

export type AvatarType = z.infer<typeof avatarTypeSchema>;

export type UserProfileRecord = {
  userId: string;
  username: string;
  usernameIsCustom: boolean;
  usernameLastChangedAt: string | null;
  usernameLockedUntil: string | null;
  profileLastChangedAt: string | null;
  profileLockedUntil: string | null;
  favoriteConstructorId: string | null;
  favoriteDriverId: string | null;
  avatarType: AvatarType;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

type UserProfileRow = {
  user_id: string;
  username: string;
  username_is_custom: boolean;
  username_last_changed_at: string | null;
  username_locked_until: string | null;
  profile_last_changed_at: string | null;
  profile_locked_until: string | null;
  favorite_constructor_id: string | null;
  favorite_driver_id: string | null;
  avatar_type: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

type LegacyUserProfileRow = {
  user_id: string;
  username: string;
  favorite_constructor_id: string | null;
  favorite_driver_id: string | null;
  avatar_type: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

function mapUserProfileRow(data: UserProfileRow): UserProfileRecord {
  return {
    userId: String(data.user_id),
    username: String(data.username),
    usernameIsCustom: Boolean(data.username_is_custom),
    usernameLastChangedAt: data.username_last_changed_at ? String(data.username_last_changed_at) : null,
    usernameLockedUntil: data.username_locked_until ? String(data.username_locked_until) : null,
    profileLastChangedAt: data.profile_last_changed_at ? String(data.profile_last_changed_at) : null,
    profileLockedUntil: data.profile_locked_until ? String(data.profile_locked_until) : null,
    favoriteConstructorId: data.favorite_constructor_id ? String(data.favorite_constructor_id) : null,
    favoriteDriverId: data.favorite_driver_id ? String(data.favorite_driver_id) : null,
    avatarType: data.avatar_type as AvatarType,
    onboardingCompleted: Boolean(data.onboarding_completed),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

function mapLegacyUserProfileRow(data: LegacyUserProfileRow): UserProfileRecord {
  return {
    userId: String(data.user_id),
    username: String(data.username),
    usernameIsCustom: false,
    usernameLastChangedAt: null,
    usernameLockedUntil: null,
    profileLastChangedAt: null,
    profileLockedUntil: null,
    favoriteConstructorId: data.favorite_constructor_id ? String(data.favorite_constructor_id) : null,
    favoriteDriverId: data.favorite_driver_id ? String(data.favorite_driver_id) : null,
    avatarType: data.avatar_type as AvatarType,
    onboardingCompleted: Boolean(data.onboarding_completed),
    createdAt: String(data.created_at),
    updatedAt: String(data.updated_at),
  };
}

function isMissingUsernameMetadataColumnsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";
  return (
    message.includes("column user_profiles.username_is_custom does not exist") ||
    message.includes("column user_profiles.username_last_changed_at does not exist") ||
    message.includes("column user_profiles.username_locked_until does not exist") ||
    message.includes("column user_profiles.profile_last_changed_at does not exist") ||
    message.includes("column user_profiles.profile_locked_until does not exist")
  );
}

function getProfileLockWindow(fromDate = new Date()) {
  return new Date(fromDate.getTime() + PROFILE_LOCK_MS);
}

function isProfileLocked(lockedUntil?: string | null, now = new Date()) {
  if (!lockedUntil) {
    return false;
  }

  const parsed = new Date(lockedUntil);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

export async function getUserProfileByIdWithClient(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfileRecord | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, username, username_is_custom, username_last_changed_at, username_locked_until, profile_last_changed_at, profile_locked_until, favorite_constructor_id, favorite_driver_id, avatar_type, onboarding_completed, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingUsernameMetadataColumnsError(error)) {
      const legacyResult = await supabase
        .from("user_profiles")
        .select("user_id, username, favorite_constructor_id, favorite_driver_id, avatar_type, onboarding_completed, created_at, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (legacyResult.error) {
        throw new Error(`Failed to load user profile: ${legacyResult.error.message}`);
      }

      return legacyResult.data ? mapLegacyUserProfileRow(legacyResult.data as LegacyUserProfileRow) : null;
    }

    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  return data ? mapUserProfileRow(data as UserProfileRow) : null;
}

export async function getUserProfileById(userId: string): Promise<UserProfileRecord | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }
  return getUserProfileByIdWithClient(supabase, userId);
}

export async function ensureProfileFromUserMetadata(user: User) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }

  const existing = await getUserProfileById(user.id);
  if (existing) {
    return existing;
  }

  const metadata = user.user_metadata ?? {};
  const favoriteConstructorId = getValidConstructorId(typeof metadata.favorite_constructor_id === "string" ? metadata.favorite_constructor_id : null);
  const favoriteDriverId = getValidDriverId(typeof metadata.favorite_driver_id === "string" ? metadata.favorite_driver_id : null);
  const avatarType = avatarTypeSchema.safeParse(metadata.avatar_type).success
    ? (metadata.avatar_type as AvatarType)
    : "constructor_logo";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const username = await suggestUniqueUsername(supabase, favoriteConstructorId, favoriteDriverId, user.id);
    const upsertRow = {
      user_id: user.id,
      username,
      username_is_custom: false,
      username_last_changed_at: null,
      username_locked_until: null,
      profile_last_changed_at: null,
      profile_locked_until: null,
      favorite_constructor_id: favoriteConstructorId,
      favorite_driver_id: favoriteDriverId,
      avatar_type: avatarType,
      onboarding_completed: Boolean(favoriteConstructorId && favoriteDriverId),
    };

    const { error } = await supabase.from("user_profiles").upsert(upsertRow as never, { onConflict: "user_id" });
    if (!error) {
      return getUserProfileById(user.id);
    }

    if (isProfileSchemaOutdatedError(error)) {
      throw createAppError({
        kind: "config",
        code: "config_error",
        status: 503,
        message: `User profile schema is outdated: ${error.message}`,
        userMessage: "Your profile schema is out of date. Run the latest Supabase SQL update, then try again.",
      });
    }

    if (!isUsernameConflictError(error)) {
      throw new Error(`Failed to bootstrap user profile: ${error.message}`);
    }
  }

  throw new Error("Failed to bootstrap user profile: generated username could not be reserved.");
}

function isUsernameConflictError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return code === "23505" || message.includes("duplicate key value") || message.includes("idx_user_profiles_username_lower");
}

function isProfileSchemaOutdatedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return code === "PGRST204" || isMissingUsernameMetadataColumnsError(error);
}

export async function upsertUserProfile(
  userId: string,
  payload: {
    username: string;
    favoriteConstructorId?: string | null;
    favoriteDriverId?: string | null;
    avatarType: AvatarType;
    confirmCustomUsernameChange?: boolean;
    onboardingCompleted?: boolean;
  },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured.");
  }

  return upsertUserProfileWithClient(supabase, userId, payload);
}

export async function upsertUserProfileWithClient(
  supabase: SupabaseClient,
  userId: string,
  payload: {
    username: string;
    favoriteConstructorId?: string | null;
    favoriteDriverId?: string | null;
    avatarType: AvatarType;
    confirmCustomUsernameChange?: boolean;
    onboardingCompleted?: boolean;
  },
) {
  const existing = await getUserProfileByIdWithClient(supabase, userId);
  const favoriteConstructorId = getValidConstructorId(payload.favoriteConstructorId ?? null);
  const favoriteDriverId = getValidDriverId(payload.favoriteDriverId ?? null);
  const now = new Date();
  let usernameIntent = await classifyUsernameIntent(supabase, payload.username, favoriteConstructorId, favoriteDriverId, userId);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const usernameChanged = existing ? existing.username !== usernameIntent.normalized : true;
    const constructorChanged = existing ? existing.favoriteConstructorId !== favoriteConstructorId : Boolean(favoriteConstructorId);
    const avatarChanged = existing ? existing.avatarType !== payload.avatarType : payload.avatarType !== "constructor_logo";
    const lockedProfileFieldChanged = constructorChanged || avatarChanged;
    const profileLocked = isProfileLocked(existing?.profileLockedUntil, now);

    if (existing?.usernameIsCustom && usernameChanged && isUsernameLocked(existing.usernameLockedUntil, now)) {
      throw createAppError({
        kind: "validation",
        code: "validation_error",
        status: 409,
        message: `Username is locked until ${existing.usernameLockedUntil}.`,
        userMessage: "Your username is locked for 7 days after the last custom change.",
      });
    }

    if (usernameChanged && usernameIntent.isCustom && !payload.confirmCustomUsernameChange) {
      throw createAppError({
        kind: "validation",
        code: "validation_error",
        status: 409,
        message: "Saving a custom username requires explicit confirmation.",
        userMessage: "Saving a custom username locks further changes for 7 days. Review and confirm before saving.",
      });
    }

    if (profileLocked && lockedProfileFieldChanged) {
      throw createAppError({
        kind: "validation",
        code: "validation_error",
        status: 409,
        message: `Profile settings are locked until ${existing?.profileLockedUntil}.`,
        userMessage: "Constructor and profile theme choices are locked for 7 days after saving. Driver selection stays editable.",
      });
    }

    const upsertRow = {
      user_id: userId,
      username: usernameIntent.normalized,
      username_is_custom: usernameIntent.isCustom,
      username_last_changed_at: usernameChanged && usernameIntent.isCustom ? now.toISOString() : existing?.usernameLastChangedAt ?? null,
      username_locked_until:
        usernameChanged && usernameIntent.isCustom
          ? getUsernameLockWindow(now).toISOString()
          : usernameIntent.isCustom
            ? existing?.usernameLockedUntil ?? null
            : null,
      profile_last_changed_at: profileLocked ? existing?.profileLastChangedAt ?? null : now.toISOString(),
      profile_locked_until: profileLocked ? existing?.profileLockedUntil ?? null : getProfileLockWindow(now).toISOString(),
      favorite_constructor_id: favoriteConstructorId,
      favorite_driver_id: favoriteDriverId,
      avatar_type: payload.avatarType,
      onboarding_completed:
        payload.onboardingCompleted ?? Boolean(usernameIntent.normalized && favoriteConstructorId && favoriteDriverId),
    };

    const { error } = await supabase.from("user_profiles").upsert(upsertRow as never, { onConflict: "user_id" });
    if (!error) {
      return getUserProfileByIdWithClient(supabase, userId);
    }

    if (isProfileSchemaOutdatedError(error)) {
      throw createAppError({
        kind: "config",
        code: "config_error",
        status: 503,
        message: `User profile schema is outdated: ${error.message}`,
        userMessage: "Your profile schema is out of date. Run the latest Supabase SQL update, then save the profile again.",
      });
    }

    if (!isUsernameConflictError(error)) {
      throw new Error(`Failed to save user profile: ${error.message}`);
    }

    if (usernameIntent.isCustom) {
      throw createAppError({
        kind: "validation",
        code: "validation_error",
        status: 409,
        message: `Username "${usernameIntent.normalized}" is already taken.`,
        userMessage: "That username is already taken. Choose a different one.",
      });
    }

    usernameIntent = {
      normalized: await suggestUniqueUsername(supabase, favoriteConstructorId, favoriteDriverId, userId),
      generated: "",
      isCustom: false,
    };
  }

  throw createAppError({
    kind: "external",
    code: "service_unavailable",
    status: 503,
    message: "Unable to reserve a generated username after multiple attempts.",
    userMessage: "A username could not be reserved right now. Try saving again.",
  });
}

export function getAuthProviderLabel(user: User) {
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : typeof user.user_metadata?.provider === "string"
        ? user.user_metadata.provider
        : "email";

  return provider === "google" ? "Google" : "Email";
}

export function isConstructorOptionValid(constructorId: string | null | undefined) {
  return Boolean(constructorId) && ACCOUNT_CONSTRUCTOR_OPTIONS.some((option) => option.id === constructorId);
}

export function isDriverOptionValid(driverId: string | null | undefined) {
  return Boolean(driverId) && ACCOUNT_DRIVER_OPTIONS.some((option) => option.id === driverId);
}

export function getValidConstructorId(constructorId: string | null | undefined) {
  return isConstructorOptionValid(constructorId) ? constructorId ?? null : null;
}

export function getValidDriverId(driverId: string | null | undefined) {
  return isDriverOptionValid(driverId) ? driverId ?? null : null;
}
