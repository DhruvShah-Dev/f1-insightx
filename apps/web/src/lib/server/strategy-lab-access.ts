import "server-only";

import { getSupabaseServerClient } from "@/lib/auth/supabase-server";

export const STRATEGY_LAB_ACCESS_HEADER = "x-strategy-lab-access";

type StrategyLabAccessResult = {
  ok: boolean;
  method?: "token" | "user";
  reason?: "not-configured" | "invalid-token" | "unauthorized" | "auth-unavailable";
};

function splitEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAllowedEmails() {
  return splitEnvList(process.env.STRATEGY_LAB_ALLOWED_EMAILS).map((email) => email.toLowerCase());
}

function getAllowedUserIds() {
  return splitEnvList(process.env.STRATEGY_LAB_ALLOWED_USER_IDS);
}

function getAccessToken() {
  const token = process.env.STRATEGY_LAB_ACCESS_TOKEN?.trim();
  return token && token.length >= 16 ? token : null;
}

export function isStrategyLabAccessConfigured() {
  return Boolean(getAccessToken() || getAllowedEmails().length > 0 || getAllowedUserIds().length > 0);
}

export function isStrategyLabTokenValid(token: string | null | undefined) {
  const configuredToken = getAccessToken();
  return Boolean(configuredToken && token && token === configuredToken);
}

export async function authorizeStrategyLabAccess(request?: Request, token?: string | null): Promise<StrategyLabAccessResult> {
  if (!isStrategyLabAccessConfigured()) {
    return { ok: false, reason: "not-configured" };
  }

  const requestToken = token ?? request?.headers.get(STRATEGY_LAB_ACCESS_HEADER);
  if (isStrategyLabTokenValid(requestToken)) {
    return { ok: true, method: "token" };
  }

  const allowedEmails = getAllowedEmails();
  const allowedUserIds = getAllowedUserIds();
  if (allowedEmails.length === 0 && allowedUserIds.length === 0) {
    return { ok: false, reason: requestToken ? "invalid-token" : "unauthorized" };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, reason: "auth-unavailable" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "unauthorized" };
  }

  const email = user.email?.toLowerCase();
  if ((email && allowedEmails.includes(email)) || allowedUserIds.includes(user.id)) {
    return { ok: true, method: "user" };
  }

  return { ok: false, reason: "unauthorized" };
}
