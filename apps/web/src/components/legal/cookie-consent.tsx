"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  COOKIE_PREFERENCES_EVENT,
  openCookiePreferences,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/legal/consent";

type ConsentView = "hidden" | "banner" | "preferences";

export function CookieConsent() {
  const [view, setView] = useState<ConsentView>("hidden");
  const [mounted, setMounted] = useState(false);
  const [storedChoice, setStoredChoice] = useState<"accepted" | "rejected" | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const manageRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);

      const choice = readCookieConsent();
      setStoredChoice(choice);
      if (!choice) {
        setView("banner");
      }
    });

    const handleOpen = () => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.requestAnimationFrame(() => {
        setView("preferences");
      });
    };

    window.addEventListener(COOKIE_PREFERENCES_EVENT, handleOpen);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener(COOKIE_PREFERENCES_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    if (view === "preferences") {
      titleRef.current?.focus();
    }
  }, [view]);

  if (!mounted || view === "hidden") {
    return null;
  }

  const dismissWithChoice = (choice: "accepted" | "rejected") => {
    writeCookieConsent(choice);
    setStoredChoice(choice);
    setView("hidden");
  };

  const showPreferences = () => {
    returnFocusRef.current = manageRef.current;
    setView("preferences");
  };

  const returnToBanner = () => {
    setView(storedChoice ? "hidden" : "banner");
    window.requestAnimationFrame(() => {
      if (storedChoice) returnFocusRef.current?.focus();
      else manageRef.current?.focus();
    });
  };

  const handlePreferencesKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      returnToBanner();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const isPreferences = view === "preferences";

  return (
    <div
      className={`cookie-consent cookie-consent--${view}`}
      role={isPreferences ? "dialog" : "region"}
      aria-modal={isPreferences ? "true" : undefined}
      aria-labelledby="cookie-consent-title"
      onKeyDown={isPreferences ? handlePreferencesKeyDown : undefined}
    >
      <div className="cookie-consent__panel">
        {view === "banner" ? (
          <>
            <div className="cookie-consent__copy">
              <p className="cookie-consent__eyebrow">Privacy baseline</p>
              <h2 id="cookie-consent-title" className="cookie-consent__title">Cookie preferences</h2>
              <p className="cookie-consent__text">
                Necessary cookies keep sign-in, security, and core site operation working.
              </p>
              <p className="cookie-consent__meta">
                Read the <Link href="/cookies">Cookie Notice</Link> and <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </div>

            <div className="cookie-consent__actions">
              <button className="hero__cta hero__cta--primary" type="button" onClick={() => dismissWithChoice("accepted")}>
                Accept
              </button>
              <button className="hero__cta hero__cta--secondary" type="button" onClick={() => dismissWithChoice("rejected")}>
                Reject non-essential
              </button>
              <button ref={manageRef} className="cookie-consent__manage" type="button" onClick={showPreferences}>
                Manage preferences
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent__copy">
              <p className="cookie-consent__eyebrow">Cookie settings</p>
              <h2 id="cookie-consent-title" ref={titleRef} tabIndex={-1} className="cookie-consent__title">Review your preferences</h2>
              <p className="cookie-consent__text">
                Necessary cookies stay on for account and security flows. Analytics and marketing cookies are not active.
              </p>
            </div>

            <div className="cookie-preferences">
              <div className="cookie-preferences__row">
                <div>
                  <strong>Necessary cookies</strong>
                  <p>Required for sign-in, session continuity, and core security protections.</p>
                </div>
                <span className="cookie-preferences__pill cookie-preferences__pill--active">Always on</span>
              </div>

              <div className="cookie-preferences__row">
                <div>
                  <strong>Analytics and performance</strong>
                  <p>Not currently deployed. If introduced later, this preference should govern whether they run.</p>
                </div>
                <span className="cookie-preferences__pill">Off</span>
              </div>
            </div>

            <div className="cookie-consent__actions">
              <button className="hero__cta hero__cta--primary" type="button" onClick={() => dismissWithChoice("accepted")}>
                Save and accept
              </button>
              <button className="hero__cta hero__cta--secondary" type="button" onClick={() => dismissWithChoice("rejected")}>
                Save and reject
              </button>
              <button className="cookie-consent__manage" type="button" onClick={returnToBanner}>
                {storedChoice ? "Close" : "Back"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button className={className ?? "cookie-preferences-button"} type="button" onClick={openCookiePreferences}>
      Cookie preferences
    </button>
  );
}
