"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type AppHeaderProps = {
  accountSlot?: ReactNode;
};

const navItems = [
  { href: "/predictions", label: "Race Week" },
  { href: "/picks", label: "Picks" },
  { href: "/lab", label: "Strategy Lab" },
  { href: "/race-analysis", label: "Race Analysis" },
  { href: "/championship", label: "Championship" },
];

export function AppHeader({ accountSlot }: AppHeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAnalyticsPage = pathname === "/race-analysis" || pathname.startsWith("/race-analysis/");

  const renderNavLinks = (closeOnNavigate = false) => navItems.map((item) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`app-header__nav-link${isActive ? " app-header__nav-link--active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={closeOnNavigate ? () => setIsMenuOpen(false) : undefined}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <header className={`app-header${isAnalyticsPage ? " app-header--analytics" : ""}`}>
      <Link href="/" className="app-header__brand" aria-label="F1 InsightX home">
        <span className="app-header__mark" aria-hidden="true" />
        <span>
          <small>Race Intelligence</small>
          <strong>F1 InsightX</strong>
        </span>
      </Link>

      <nav className="app-header__nav" aria-label="Primary">
        {renderNavLinks()}
      </nav>

      <div className="app-header__actions">
        {accountSlot ?? (
          <Link href="/account" className="app-header__account">
            Account
          </Link>
        )}
        <button
          type="button"
          className="app-header__menu-button"
          aria-controls="app-header-menu"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? "Close" : "Menu"}
        </button>
      </div>

      <nav
        id="app-header-menu"
        className={`app-header__mobile-nav${isMenuOpen ? " app-header__mobile-nav--open" : ""}`}
        aria-label="Primary mobile"
      >
        {renderNavLinks(true)}
      </nav>
    </header>
  );
}
