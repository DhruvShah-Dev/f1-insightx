"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AccountAuthPanel } from "@/components/account/account-auth-panel";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type HomeAccountEntryProps = {
  hasSupabaseAuth: boolean;
  hasProfilePersistence: boolean;
};

export function HomeAccountEntry({
  hasSupabaseAuth,
  hasProfilePersistence,
}: HomeAccountEntryProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [authState, setAuthState] = useState<"unknown" | "authenticated" | "anonymous">(
    hasSupabaseAuth ? "unknown" : "anonymous",
  );
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!hasSupabaseAuth) {
      setAuthState("anonymous");
      return;
    }

    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    const loadUser = async () => {
      const result = await supabase.auth.getUser();
      if (!isMounted) {
        return;
      }
      setAuthState(result.data.user ? "authenticated" : "anonymous");
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) {
        return;
      }
      setAuthState(session?.user ? "authenticated" : "anonymous");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [hasSupabaseAuth]);

  const handleEntryClick = async () => {
    if (!hasSupabaseAuth) {
      setIsOpen(true);
      return;
    }

    setIsCheckingAuth(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setAuthState("authenticated");
        router.push("/profile");
        router.refresh();
        return;
      }

      setAuthState("anonymous");
      setIsOpen(true);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="account-entry account-entry--header topbar__nav-item"
        onClick={handleEntryClick}
        aria-haspopup={authState === "authenticated" ? undefined : "dialog"}
        aria-expanded={isOpen}
      >
        {isCheckingAuth ? "Checking" : authState === "authenticated" ? "Profile" : "Account"}
      </button>

      {isOpen ? (
        <div className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title" onMouseDown={() => setIsOpen(false)}>
          <div className="account-modal__backdrop" />
          <div className="account-modal__panel" onMouseDown={(event) => event.stopPropagation()}>
            <AccountAuthPanel
              hasSupabaseAuth={hasSupabaseAuth}
              hasProfilePersistence={hasProfilePersistence}
              surface="modal"
              initialMode="sign-in"
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
