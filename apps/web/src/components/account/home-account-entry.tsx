"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type AuthState = "authenticated" | "anonymous";

type HomeAccountEntryProps = {
  hasSupabaseAuth: boolean;
  hasProfilePersistence: boolean;
  initialAuthState?: AuthState;
};

export function HomeAccountEntry({
  hasSupabaseAuth,
  initialAuthState = "anonymous",
}: HomeAccountEntryProps) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(hasSupabaseAuth ? initialAuthState : "anonymous");
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  useEffect(() => {
    if (!hasSupabaseAuth) {
      setAuthState("anonymous");
      return;
    }

    let isActive = true;
    const supabase = getSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (isActive) {
        setAuthState(session?.user ? "authenticated" : "anonymous");
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [hasSupabaseAuth]);

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
    } catch {
      setAuthState("anonymous");
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
      aria-label={authState === "authenticated" ? "Open profile" : "Open account sign in"}
    >
      {isCheckingAuth ? "Checking" : authState === "authenticated" ? "Profile" : "Account"}
    </button>
  );
}
