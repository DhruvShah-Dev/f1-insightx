import { Link, useLocation } from "@tanstack/react-router";
import { ArrowUpRight, ChartNoAxesCombined, CircleUserRound, FlagTriangleRight, GitCompareArrows, House, Target, Trophy } from "lucide-react";
import { seasonState } from "@/data/season";
import { fmtDate } from "@/lib/format";
import { useEffect, useRef } from "react";
import "./site-chrome.css";

const sections = [
  { to: "/", label: "Home", icon: House, key: "home" },
  { to: "/raceweek", label: "RaceWeek", icon: FlagTriangleRight, key: "raceweek" },
  { to: "/analysis", label: "Analysis", icon: ChartNoAxesCombined, key: "analysis" },
  { to: "/vs", label: "Vs", icon: GitCompareArrows, key: "vs" },
  { to: "/picks", label: "Picks", icon: Target, key: "picks" },
  { to: "/championship", label: "Championship", icon: Trophy, key: "championship" },
  { to: "/account", label: "Account", icon: CircleUserRound, key: "account" },
] as const;

const pageDetails = {
  home: { title: "Race control.", next: "/raceweek", nextLabel: "RaceWeek" },
  raceweek: { title: "RaceWeek.", next: "/analysis", nextLabel: "Analysis" },
  analysis: { title: "Analysis.", next: "/vs", nextLabel: "Vs" },
  vs: { title: "Head to head.", next: "/picks", nextLabel: "Picks" },
  picks: { title: "Picks.", next: "/championship", nextLabel: "Championship" },
  championship: { title: "Championship.", next: "/raceweek", nextLabel: "RaceWeek" },
  account: { title: "Account.", next: "/picks", nextLabel: "Picks" },
  method: { title: "Method.", next: "/analysis", nextLabel: "Analysis" },
  legal: { title: "Your information.", next: "/account", nextLabel: "Account" },
} as const;

type PageKey = keyof typeof pageDetails;

function currentPage(pathname: string): PageKey {
  if (pathname.startsWith("/method")) return "method";
  if (["/privacy", "/terms", "/cookies"].some((path) => pathname.startsWith(path))) return "legal";
  return sections.find((item) => item.to !== "/" && pathname.startsWith(item.to))?.key ?? "home";
}

export function SiteHeader() {
  const pathname = useLocation().pathname;
  const page = currentPage(pathname);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mobileLayout = window.matchMedia("(max-width: 1120px)");
    const showActive = () => {
      if (!mobileLayout.matches) return;
      const nav = mobileNavRef.current;
      const active = nav?.querySelector<HTMLElement>(".is-active");
      if (!nav || !active) return;
      nav.scrollTo({
        left: active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    };
    showActive();
    mobileLayout.addEventListener("change", showActive);
    return () => mobileLayout.removeEventListener("change", showActive);
  }, [pathname]);

  return (
    <header className={`ix-header ix-theme-${page}`}>
      <div className="ix-header-inner">
        <Link to="/" className="ix-brand" aria-label="F1 InsightX home">
          <svg className="ix-brand-mark" viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <path d="M7 7h82v82H7z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M18 24h42l-7 10H30v12h22l-7 10H30v19H18V24Z" fill="currentColor" />
            <path d="M69 24h11v51H68V41l-10 6V35l11-11Z" fill="currentColor" />
            <path d="M12 84h72" stroke="var(--ix-accent)" strokeWidth="4" />
          </svg>
          <span className="ix-brand-name">INSIGHT<span>X</span></span>
        </Link>
        <nav className="ix-nav" aria-label="Main navigation">
          {sections.slice(1, 6).map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: false }} activeProps={{ className: "is-active" }}>
              <Icon aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
        <Link to="/account" className="ix-account" activeProps={{ className: "is-active" }}>
          <CircleUserRound aria-hidden="true" /><span>Account</span>
        </Link>
      </div>
      <nav ref={mobileNavRef} className="ix-mobile-nav" aria-label="Main navigation">
        {sections.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/" }} activeProps={{ className: "is-active" }}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const page = currentPage(useLocation().pathname);
  const detail = pageDetails[page];
  return (
    <footer className={`ix-footer ix-theme-${page}`}>
      <div className="ix-footer-art" aria-hidden="true" />
      <div className="ix-footer-main">
        <div className="ix-footer-heading">
          <p>{detail.title}</p>
          <Link to={detail.next} className="ix-footer-next">Explore {detail.nextLabel}<ArrowUpRight aria-hidden="true" /></Link>
        </div>
        <nav className="ix-footer-links" aria-label="Footer navigation">
          {sections.map(({ to, label }) => <Link key={to} to={to}>{label}<ArrowUpRight aria-hidden="true" /></Link>)}
          <Link to="/method">Method<ArrowUpRight aria-hidden="true" /></Link>
          <Link to="/privacy">Privacy<ArrowUpRight aria-hidden="true" /></Link>
          <Link to="/terms">Terms<ArrowUpRight aria-hidden="true" /></Link>
          <Link to="/cookies">Cookies & storage<ArrowUpRight aria-hidden="true" /></Link>
          <a href="mailto:f1.insightx@gmail.com">Contact<ArrowUpRight aria-hidden="true" /></a>
        </nav>
      </div>
      <div className="ix-footer-bottom">
        <Link to="/" className="ix-footer-wordmark">INSIGHT<span>X</span></Link>
        <span>{seasonState.season} · Local snapshot through {fmtDate(seasonState.resultsThrough.date)}</span>
        <small>Independent and unofficial. Not affiliated with Formula 1, FIA, or any team. F1, FORMULA 1, and GRAND PRIX marks belong to Formula One Licensing BV. Picks are informational, not betting advice; no money is staked.</small>
      </div>
    </footer>
  );
}
