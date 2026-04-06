export const COOKIE_CONSENT_COOKIE = "f1ix_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180;
export const COOKIE_PREFERENCES_EVENT = "f1ix:open-cookie-preferences";

export type CookieConsentChoice = "accepted" | "rejected";

function canUseDocument() {
  return typeof document !== "undefined";
}

export function readCookieConsent(): CookieConsentChoice | null {
  if (!canUseDocument()) {
    return null;
  }

  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`));

  if (!entry) {
    return null;
  }

  const value = decodeURIComponent(entry.slice(COOKIE_CONSENT_COOKIE.length + 1));
  return value === "accepted" || value === "rejected" ? value : null;
}

export function writeCookieConsent(choice: CookieConsentChoice) {
  if (!canUseDocument()) {
    return;
  }

  document.cookie = [
    `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(choice)}`,
    "Path=/",
    `Max-Age=${COOKIE_CONSENT_MAX_AGE}`,
    "SameSite=Lax",
    location.protocol === "https:" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function openCookiePreferences() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT));
}
