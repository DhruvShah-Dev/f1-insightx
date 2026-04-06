"use client";

import Link from "next/link";
import { CookiePreferencesButton } from "@/components/legal/cookie-consent";

type LegalLinksProps = {
  className?: string;
  includePreferencesButton?: boolean;
};

export function LegalLinks({ className, includePreferencesButton = true }: LegalLinksProps) {
  return (
    <nav className={className ?? "legal-links"} aria-label="Legal">
      <Link href="/privacy">Privacy</Link>
      <span aria-hidden="true">|</span>
      <Link href="/terms">Terms</Link>
      <span aria-hidden="true">|</span>
      <Link href="/cookies">Cookies</Link>
      {includePreferencesButton ? (
        <>
          <span aria-hidden="true">|</span>
          <CookiePreferencesButton className="legal-links__button" />
        </>
      ) : null}
    </nav>
  );
}
