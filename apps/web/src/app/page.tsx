import Link from "next/link";
import { HomeAccountEntry } from "@/components/account/home-account-entry";
import { ConstructorStandingsSection } from "@/components/home/constructor-standings-section";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { HomeScrollReveal } from "@/components/home/home-scroll-reveal";
import { MainPageBackground } from "@/components/home/main-page-background";
import { ModuleLink } from "@/components/home/module-link";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { LegalLinks } from "@/components/legal/legal-links";
import { getServerEnv } from "@/lib/env";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";

export default async function Home() {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const hasProfilePersistence = hasSupabaseAdmin && hasSupabaseAuth;
  const [constructorStandings, raceHistory, driverStandings] = await Promise.all([
    getCurrentSeasonConstructorStandings(),
    listCompletedRaceHistory(10),
    getCurrentSeasonDriverStandings(),
  ]);

  return (
    <main className="home-shell">
      <MainPageBackground />
      <HomeScrollReveal />

      <div className="home-shell__content">
        <header className="topbar">
          <div className="topbar__nav-shell">
            <nav className="topbar__nav">
              <Link href="/predictions" className="topbar__nav-item">
                Race Week
              </Link>
              <Link href="/lab" className="topbar__nav-item">
                Strategy Lab
              </Link>
              <Link href="/fantasy" className="topbar__nav-item">
                Fantasy Builder
              </Link>
              <HomeAccountEntry hasSupabaseAuth={hasSupabaseAuth} hasProfilePersistence={hasProfilePersistence} />
            </nav>
          </div>
        </header>

        <section className="hero">
          <div className="hero__backdrop" />
          <div className="hero__content">
            <div className="hero__copy">
              <h1 className="hero__brand">F1 InsightX</h1>
              <p className="hero__tagline" aria-label="Analyze, Strategize, Execute">
                <span>Analyze</span>
                <span className="hero__tagline-dot" aria-hidden="true">
                  &middot;
                </span>
                <span>Strategize</span>
                <span className="hero__tagline-dot" aria-hidden="true">
                  &middot;
                </span>
                <span>Execute</span>
              </p>
              <div className="hero__actions">
                <Link href="/lab" className="hero__cta hero__cta--primary">
                  Open Strategy Lab
                </Link>
                <Link href="/fantasy" className="hero__cta hero__cta--secondary">
                  Open Fantasy Builder
                </Link>
              </div>
            </div>
          </div>
        </section>

        <ConstructorStandingsSection standings={constructorStandings} />

        <section className="feature-showcase" data-home-reveal>
          <div className="section-shell feature-showcase__header">
            <div className="section-meta">Products</div>
            <h2 className="section-title">Strategy and fantasy.</h2>
            <p className="section-copy">Two focused surfaces for race week.</p>
          </div>

          <div className="module-grid feature-showcase__grid">
            <ModuleLink
              href="/lab"
              index="01"
              state="Live"
              title="Strategy Lab"
              summary="Scenario simulator"
              visualTeamId="red_bull"
            />
            <ModuleLink
              href="/fantasy"
              index="02"
              state="Live"
              title="Fantasy Builder"
              summary="Lineup optimizer"
              visualTeamId="mclaren"
            />
          </div>
        </section>

        <RaceHistoryRail races={raceHistory} />
        <DriverStandingsSection standings={driverStandings} />

        <footer className="home-footer">
          <LegalLinks className="home-footer__nav home-footer__nav--legal" />
          <nav className="home-footer__nav home-footer__nav--products" aria-label="Homepage footer">
            <Link href="/predictions">Race Week</Link>
            <span aria-hidden="true">|</span>
            <Link href="/lab">Strategy Lab</Link>
            <span aria-hidden="true">|</span>
            <Link href="/fantasy">Fantasy Builder</Link>
            <span aria-hidden="true">|</span>
            <Link href="/account">Profile</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
