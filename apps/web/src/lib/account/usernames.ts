import type { SupabaseClient } from "@supabase/supabase-js";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 24;
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{2,22})$/;
export const USERNAME_LOCK_DAYS = 7;
export const USERNAME_LOCK_MS = USERNAME_LOCK_DAYS * 24 * 60 * 60 * 1000;

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "support",
  "official",
  "moderator",
  "mod",
  "root",
  "system",
  "owner",
  "team",
  "staff",
  "security",
  "helpdesk",
  "superuser",
  "f1insightx",
  "insightx",
]);

const UNSAFE_PATTERNS = [
  "fuck",
  "fucker",
  "shit",
  "bitch",
  "cunt",
  "porn",
  "sex",
  "sexy",
  "nude",
  "slut",
  "whore",
  "dick",
  "penis",
  "vagina",
  "pussy",
  "cock",
  "rape",
  "nazi",
];

const LEET_CHARACTER_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
};

const sanitizeCode = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 3);

function normalizeSafetyString(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/./g, (character) => LEET_CHARACTER_MAP[character] ?? character)
    .replace(/[^a-z]/g, "");
}

function getConstructorCode(constructorId?: string | null) {
  if (!constructorId) {
    return "f1";
  }

  const team = getTeamAsset(constructorId);
  return sanitizeCode(team.shortLabel || team.label || constructorId) || "f1";
}

function getDriverCode(driverId?: string | null) {
  if (!driverId) {
    return "user";
  }

  const driver = getCurrentDriverMeta(driverId);
  return sanitizeCode(driver.driverCode || driver.lastName || driverId) || "user";
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return { ok: false as const, message: "Username must be at least 4 characters." };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      message: "Use lowercase letters, numbers, and underscores only.",
    };
  }

  const condensed = normalized.replace(/_/g, "");
  const safetyNormalized = normalizeSafetyString(normalized);

  if (RESERVED_USERNAMES.has(condensed) || RESERVED_USERNAMES.has(safetyNormalized)) {
    return {
      ok: false as const,
      message: "That username is restricted. Choose a different one.",
    };
  }

  if (UNSAFE_PATTERNS.some((term) => condensed.includes(term) || safetyNormalized.includes(term))) {
    return {
      ok: false as const,
      message: "Choose a safe-for-work username.",
    };
  }

  return { ok: true as const, normalized };
}

export function buildUsernameBase(constructorId?: string | null, driverId?: string | null) {
  return `${getConstructorCode(constructorId)}_${getDriverCode(driverId)}`;
}

export function getUsernameLockWindow(fromDate = new Date()) {
  return new Date(fromDate.getTime() + USERNAME_LOCK_MS);
}

export function isUsernameLocked(lockedUntil?: string | null, now = new Date()) {
  if (!lockedUntil) {
    return false;
  }

  const parsed = new Date(lockedUntil);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

export async function isUsernameAvailable(
  supabase: SupabaseClient,
  username: string,
  excludeUserId?: string,
) {
  const normalized = normalizeUsername(username);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, username")
    .eq("username", normalized)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check username availability: ${error.message}`);
  }

  const taken = (data ?? []).some((row) => row.user_id !== excludeUserId);
  return !taken;
}

export async function suggestUniqueUsername(
  supabase: SupabaseClient,
  constructorId?: string | null,
  driverId?: string | null,
  excludeUserId?: string,
) {
  const base = buildUsernameBase(constructorId, driverId);

  for (let suffix = 1; suffix <= 9999; suffix += 1) {
    const candidate = `${base}${suffix}`;
    const available = await isUsernameAvailable(supabase, candidate, excludeUserId);
    if (available) {
      return candidate;
    }
  }

  const timestampSuffix = Date.now().toString().slice(-4);
  return `${base}${timestampSuffix}`.slice(0, USERNAME_MAX_LENGTH);
}

export async function classifyUsernameIntent(
  supabase: SupabaseClient,
  username: string,
  constructorId?: string | null,
  driverId?: string | null,
  excludeUserId?: string,
) {
  const normalized = normalizeUsername(username);
  const generated = await suggestUniqueUsername(supabase, constructorId, driverId, excludeUserId);

  return {
    normalized,
    generated,
    isCustom: normalized !== generated,
  };
}
