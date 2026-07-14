"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { ACCOUNT_API_ROUTES, readAccountApiData } from "@/lib/account/api";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type AuthState = "authenticated" | "anonymous";
type AccountProfilePayload = {
  profile?: {
    username?: string;
  } | null;
};

type HomeAccountEntryProps = {
  hasSupabaseAuth: boolean;
  hasProfilePersistence: boolean;
  initialAuthState?: AuthState;
  initialUsername?: string;
};

export function HomeAccountEntry({
  hasSupabaseAuth,
  hasProfilePersistence,
  initialAuthState = "anonymous",
  initialUsername = "",
}: HomeAccountEntryProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(hasSupabaseAuth ? initialAuthState : "anonymous");
  const [username, setUsername] = useState(initialUsername);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  useEffect(() => {
    if (!hasSupabaseAuth) {
      setAuthState("anonymous");
      setUsername("");
      return;
    }

    let isActive = true;
    const supabase = getSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (isActive) {
        setAuthState(session?.user ? "authenticated" : "anonymous");
        setUsername(readSessionUsername(session));
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [hasSupabaseAuth]);

  useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername]);

  useEffect(() => {
    if (!hasSupabaseAuth || !hasProfilePersistence || authState !== "authenticated") {
      return;
    }

    const controller = new AbortController();

    const loadUsername = async () => {
      try {
        const response = await fetch(ACCOUNT_API_ROUTES.profile, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = await response.json().catch(() => null) as unknown;
        const data = readAccountApiData<AccountProfilePayload>(payload);
        const nextUsername = data?.profile?.username?.trim();
        if (nextUsername) {
          setUsername(nextUsername);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
      }
    };

    void loadUsername();

    return () => controller.abort();
  }, [authState, hasProfilePersistence, hasSupabaseAuth]);

  useEffect(() => {
    const handleProfileUpdate = (event: Event) => {
      const nextUsername = event instanceof CustomEvent && typeof event.detail?.username === "string"
        ? event.detail.username.trim()
        : "";
      if (nextUsername) {
        setAuthState("authenticated");
        setUsername(nextUsername);
      }
    };

    window.addEventListener("f1-insightx:profile-updated", handleProfileUpdate);
    return () => window.removeEventListener("f1-insightx:profile-updated", handleProfileUpdate);
  }, []);

  const handleEntryClick = async () => {
    if (!hasSupabaseAuth) {
      router.push("/account");
      return;
    }

    setIsCheckingAuth(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setAuthState(session?.user ? "authenticated" : "anonymous");
      setUsername(readSessionUsername(session));
    } catch {
      setAuthState("anonymous");
      setUsername("");
    } finally {
      setIsCheckingAuth(false);
      router.push("/account");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      className="account-entry account-entry--header topbar__nav-item"
      onClick={handleEntryClick}
      aria-label={authState === "authenticated" ? `Open account for ${username || "signed-in user"}` : "Open account sign in"}
    >
      {isCheckingAuth ? "Checking" : authState === "authenticated" ? username || "Account" : "Account"}
    </button>
  );
}

function readSessionUsername(session: Session | null) {
  const value = session?.user.user_metadata?.username;
  return typeof value === "string" ? value.trim() : "";
}
