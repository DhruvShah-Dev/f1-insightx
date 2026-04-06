"use client";

import { useEffect, useState } from "react";
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

  if (!mounted || view === "hidden") {
    return null;
  }

  const dismissWithChoice = (choice: "accepted" | "rejected") => {
    writeCookieConsent(choice);
    setStoredChoice(choice);
    setView("hidden");
  };

  const showPreferences = () => {
    setView("preferences");
  };

  const returnToBanner = () => {
    setView(storedChoice ? "hidden" : "banner");
  };

  return (
    <div className="cookie-consent" role="region" aria-label="Cookie preferences">
      <div className="cookie-consent__panel">
        {view === "banner" ? (
          <>
            <div className="cookie-consent__copy">
              <p className="cookie-consent__eyebrow">Privacy baseline</p>
              <h2 className="cookie-consent__title">Cookie preferences</h2>
              <p className="cookie-consent__text">
                F1 InsightX currently uses necessary cookies for sign-in, account security, and core site operation. You
                can accept the current baseline, reject future non-essential cookies, or review preferences.
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
              <button className="cookie-consent__manage" type="button" onClick={showPreferences}>
                Manage preferences
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent__copy">
              <p className="cookie-consent__eyebrow">Cookie settings</p>
              <h2 className="cookie-consent__title">Review your preferences</h2>
              <p className="cookie-consent__text">
                Necessary cookies remain on because the account and auth flows depend on them. Analytics or marketing
                cookies are not currently active in the product.
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
