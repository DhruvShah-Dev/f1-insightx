import Link from "next/link";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { LiveStatus } from "@/components/home/live-status";
import { ModuleLink } from "@/components/home/module-link";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { TeamFieldShowcase } from "@/components/home/team-field-showcase";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getCurrentSeasonDriverStandings } from "@/lib/server/standings";

export default async function Home() {
  const raceHistory = await listCompletedRaceHistory(18);
  const driverStandings = await getCurrentSeasonDriverStandings();

  return (
    <main className="home-shell">
      <header className="topbar">
        <div>
          <p className="topbar__brand">F1 InsightX</p>
          <p className="topbar__caption">Race strategy intelligence and fantasy lineup design</p>
        </div>
        <nav className="topbar__nav">
          <Link href="/lab">Prediction Lab</Link>
          <Link href="/fantasy">Fantasy Builder</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__backdrop" />
        <div className="hero__content">
          <div className="hero__copy">
            <h1 className="hero__brand">F1 InsightX</h1>
            <p className="hero__line">Read a Grand Prix like a strategist</p>
            <p className="hero__line">Draft a fantasy team like an analyst</p>
            <p className="hero__summary">
              F1 InsightX combines scenario-based race simulation, constructor-aware visual identity,
              and fantasy roster optimization inside one premium motorsport analytics surface.
            </p>
            <div className="hero__action-label">Start exploring</div>
            <div className="hero__actions">
              <Link href="/lab" className="hero__cta hero__cta--primary">
                Open Prediction Lab
              </Link>
              <Link href="/fantasy" className="hero__cta hero__cta--secondary">
                Open Fantasy Builder
              </Link>
            </div>
          </div>
        </div>
      </section>

      <DriverStandingsSection standings={driverStandings} />
      <RaceHistoryRail races={raceHistory} />

      <section className="feature-showcase">
        <div className="section-shell feature-showcase__header">
          <div>
            <div className="section-meta">Core modules</div>
            <h2 className="section-title">Strategy and fantasy, built as working tools.</h2>
            <p className="section-copy">
              Move from race scenario analysis into roster optimization without leaving the product surface.
            </p>
          </div>
          <div className="feature-showcase__status">
            <span className="feature-showcase__status-label">Data mode</span>
            <LiveStatus />
          </div>
        </div>

        <div className="module-grid feature-showcase__grid">
          <ModuleLink
            href="/lab"
            index="01"
            state="Live"
            title="Race Prediction Lab"
            summary="Model pit windows, weather, qualifying position, and safety-car pressure against a historical grid."
            points={["Scenario editor", "Confidence output", "Undercut logic"]}
            visualTeamId="red_bull"
          />
          <ModuleLink
            href="/fantasy"
            index="02"
            state="Live"
            title="Fantasy Team Builder"
            summary="Balance budget, value, and volatility across a five-driver, two-constructor roster."
            points={["Budget planner", "Captain logic", "Aggressive variants"]}
            visualTeamId="mclaren"
          />
        </div>
      </section>

      <TeamFieldShowcase />
    </main>
  );
}
