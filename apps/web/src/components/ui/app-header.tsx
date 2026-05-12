"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppHeaderProps = {
  title?: string;
  eyebrow?: string;
  actionHref?: string;
  actionLabel?: string;
  accountSlot?: ReactNode;
  compact?: boolean;
};

const navItems = [
  { href: "/predictions", label: "Race Week" },
  { href: "/lab", label: "Strategy Lab" },
  { href: "/analytics", label: "Analytics" },
  { href: "/race-analysis", label: "Race Analysis" },
  { href: "/fantasy", label: "Fantasy" },
];

export function AppHeader({
  title = "F1 InsightX",
  eyebrow,
  actionHref,
  actionLabel,
  accountSlot,
  compact = false,
}: AppHeaderProps) {
  return (
    <header className={`app-header${compact ? " app-header--compact" : ""}`}>
      <Link href="/" className="app-header__brand" aria-label="F1 InsightX home">
        <span className="app-header__mark" aria-hidden="true" />
        <span>
          {eyebrow ? <small>{eyebrow}</small> : null}
          <strong>{title}</strong>
        </span>
      </Link>

      <nav className="app-header__nav" aria-label="Primary">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="app-header__nav-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="app-header__actions">
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="app-header__action">
            {actionLabel}
          </Link>
        ) : null}
        {accountSlot ?? (
          <Link href="/account" className="app-header__account">
            Account
          </Link>
        )}
      </div>
    </header>
  );
}
