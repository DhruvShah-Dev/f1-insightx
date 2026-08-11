"use client";

import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__brand">
        <strong>F1 InsightX</strong>
        <span>Race intelligence, strategy simulation, and telemetry-derived insight.</span>
      </div>
      <div className="app-footer__groups">
        <nav className="app-footer__links" aria-label="Sections">
          <span className="app-footer__group-label">Sections</span>
          <Link href="/predictions">Race Week</Link>
          <Link href="/race-analysis">Race Analysis</Link>
          <Link href="/championship">Championship</Link>
        </nav>
        <nav className="app-footer__links" aria-label="Legal">
          <span className="app-footer__group-label">Legal</span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/cookies">Cookies</Link>
        </nav>
      </div>
    </footer>
  );
}
