"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { AccountAuthPanel } from "@/components/account/account-auth-panel";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type AuthState = "unknown" | "authenticated" | "anonymous";

type HomeAccountEntryProps = {
  hasSupabaseAuth: boolean;
  hasProfilePersistence: boolean;
  initialAuthState?: Exclude<AuthState, "unknown">;
};

export function HomeAccountEntry({
  hasSupabaseAuth,
  hasProfilePersistence,
  initialAuthState = "anonymous",
}: HomeAccountEntryProps) {
  const router = useRouter();
  const [isModalMounted, setIsModalMounted] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(hasSupabaseAuth ? initialAuthState : "anonymous");
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const openModal = () => {
    setIsModalMounted(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    if (!isModalMounted) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsModalVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isModalMounted]);

  useEffect(() => {
    if (!isModalMounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add("account-modal-open");
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement || !panelRef.current.contains(activeElement)) {
        first.focus();
        event.preventDefault();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        last.focus();
        event.preventDefault();
        return;
      }

      if (!event.shiftKey && activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("account-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalMounted]);

  useEffect(() => {
    if (!isModalMounted || !isModalVisible) {
      return;
    }

    const focusTarget =
      panelRef.current?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ??
      panelRef.current;
    focusTarget?.focus();
  }, [isModalMounted, isModalVisible]);

  useEffect(() => {
    if (!isModalMounted || isModalVisible) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsModalMounted(false);
      triggerRef.current?.focus();
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isModalMounted, isModalVisible]);

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
      if (!isActive) {
        return;
      }
      setAuthState(session?.user ? "authenticated" : "anonymous");
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [hasSupabaseAuth]);

  const handleEntryClick = async () => {
    if (!hasSupabaseAuth) {
      openModal();
      return;
    }

    if (authState === "authenticated") {
      router.push("/account");
      router.refresh();
      return;
    }

    setIsCheckingAuth(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setAuthState("authenticated");
        router.push("/account");
        router.refresh();
        return;
      }

      setAuthState("anonymous");
      openModal();
    } catch {
      setAuthState("anonymous");
      openModal();
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const modalContent = isModalMounted ? (
    <div
      className={`account-modal ${isModalVisible ? "account-modal--open" : "account-modal--closing"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="account-modal__backdrop" onMouseDown={closeModal} />
      <div ref={panelRef} className="account-modal__panel" onMouseDown={(event) => event.stopPropagation()} tabIndex={-1}>
        <AccountAuthPanel
          hasSupabaseAuth={hasSupabaseAuth}
          hasProfilePersistence={hasProfilePersistence}
          surface="modal"
          initialMode="sign-in"
          onClose={closeModal}
        />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="account-entry account-entry--header topbar__nav-item"
        onClick={handleEntryClick}
        aria-haspopup={authState === "authenticated" ? undefined : "dialog"}
        aria-expanded={isModalMounted}
      >
        {isCheckingAuth ? "Checking" : authState === "authenticated" ? "Profile" : "Account"}
      </button>
      {typeof document !== "undefined" ? createPortal(modalContent, document.body) : null}
    </>
  );
}
