import Link from "next/link";
import { HomeAccountEntry } from "@/components/account/home-account-entry";
import { ConstructorStandingsSection } from "@/components/home/constructor-standings-section";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { HomeScrollReveal } from "@/components/home/home-scroll-reveal";
import { MainPageBackground } from "@/components/home/main-page-background";
import { ModuleLink } from "@/components/home/module-link";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { AppFooter } from "@/components/ui/app-footer";
import { AppHeader } from "@/components/ui/app-header";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";

export default async function Home() {
  const { hasSupabaseAdmin, hasSupabaseAuth } = getServerEnv();
  const hasProfilePersistence = hasSupabaseAdmin && hasSupabaseAuth;
  const authStatePromise = (async () => {
    if (!hasSupabaseAuth) {
      return "anonymous" as const;
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return "anonymous" as const;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.user ? ("authenticated" as const) : ("anonymous" as const);
  })();

  const [constructorStandings, raceHistory, driverStandings, initialAuthState] = await Promise.all([
    getCurrentSeasonConstructorStandings(),
    listCompletedRaceHistory(10),
    getCurrentSeasonDriverStandings(),
    authStatePromise,
  ]);
  const seasonState = await getSeasonState();

  return (
    <main className="home-shell">
      <MainPageBackground />
      <HomeScrollReveal />

      <div className="home-shell__content">
        <AppHeader
          accountSlot={(
            <HomeAccountEntry
              hasSupabaseAuth={hasSupabaseAuth}
              hasProfilePersistence={hasProfilePersistence}
              initialAuthState={initialAuthState}
            />
          )}
        />

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
                <Link href="/analytics" className="hero__cta hero__cta--primary">
                  Open Analytics
                </Link>
                <Link href="/lab" className="hero__cta hero__cta--secondary">
                  Open Strategy Lab
                </Link>
              </div>
              <div className="hero__season-state" aria-label="Season state">
                <span>Completed: {formatSeasonRaceLabel(seasonState?.latest_completed_race)}</span>
                <span>Next: {formatSeasonRaceLabel(seasonState?.next_race)}</span>
                <span>Telemetry: {formatSeasonRaceLabel(seasonState?.latest_completed_race_with_analytics)}</span>
              </div>
            </div>
          </div>
        </section>

        <ConstructorStandingsSection standings={constructorStandings} />

        <section className="feature-showcase" data-home-reveal>
          <div className="section-shell feature-showcase__header">
            <div className="section-meta">Products</div>
            <h2 className="section-title">Telemetry and strategy.</h2>
              <p className="section-copy">Flagship analysis, simulation, and race-week tools.</p>
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
            <ModuleLink
              href="/analytics"
              index="03"
              state="Live"
              title="Analytics"
              summary="Driver comparison"
              visualTeamId="mercedes"
            />
          </div>
        </section>

        <RaceHistoryRail races={raceHistory} />
        <DriverStandingsSection standings={driverStandings} />

        <AppFooter />
      </div>
    </main>
  );
}
