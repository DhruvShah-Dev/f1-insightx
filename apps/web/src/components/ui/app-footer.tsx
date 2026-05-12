"use client";

import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__brand">
        <strong>F1 InsightX</strong>
        <span>Race intelligence, strategy simulation, and telemetry-derived insight.</span>
      </div>
      <nav className="app-footer__links" aria-label="Footer">
        <Link href="/predictions">Race Week</Link>
        <Link href="/lab">Strategy Lab</Link>
        <Link href="/analytics">Analytics</Link>
        <Link href="/race-analysis">Race Analysis</Link>
        <Link href="/fantasy">Fantasy</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cookies">Cookies</Link>
      </nav>
    </footer>
  );
}
