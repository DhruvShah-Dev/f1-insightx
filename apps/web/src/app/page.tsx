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
import { TrackMap } from "@/components/ui/track-map";
import { getSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerEnv } from "@/lib/env";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getSeasonState, type SeasonRaceRef } from "@/lib/server/season-state";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";

const CIRCUIT_DISPLAY_NAMES: Record<string, string> = {
  monaco: "Circuit de Monaco",
};

function formatRaceDate(value: string | null | undefined) {
  if (!value) {
    return "Schedule pending";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Schedule pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatCountdown(value: string | null | undefined) {
  if (!value) {
    return "Race time pending";
  }

  const raceTime = new Date(value).getTime();
  if (Number.isNaN(raceTime)) {
    return "Race time pending";
  }

  const diffMs = raceTime - Date.now();
  if (diffMs <= 0) {
    return "Race window active";
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

  if (days > 0) {
    return `${days}d ${hours}h to lights out`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m to lights out`;
  }

  return `${Math.max(minutes, 1)}m to lights out`;
}

function getCircuitDisplayName(race: SeasonRaceRef | null | undefined) {
  if (!race?.circuit_id) {
    return "Circuit pending";
  }

  return CIRCUIT_DISPLAY_NAMES[race.circuit_id] ?? race.race_name?.replace(/\s+Grand Prix$/i, "") ?? race.circuit_id;
}

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
  const nextRace = seasonState?.next_race ?? null;
  const nextRaceCircuitName = getCircuitDisplayName(nextRace);

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
              {nextRace ? (
                <div className="hero__next-race" aria-label="Next race">
                  <div className="hero__next-race-copy">
                    <span className="hero__next-race-kicker">Next race</span>
                    <strong>{nextRace.race_name ?? "Race pending"}</strong>
                    <span>{nextRaceCircuitName}</span>
                    <div className="hero__next-race-meta">
                      <span>{nextRace.round ? `Round ${nextRace.round}` : "Round pending"}</span>
                      <span>{formatRaceDate(nextRace.scheduled_at)}</span>
                    </div>
                    <p>{formatCountdown(nextRace.scheduled_at)}</p>
                  </div>
                  {nextRace.circuit_id ? (
                    <div className="hero__next-race-map">
                      <TrackMap
                        circuitId={nextRace.circuit_id}
                        title={nextRaceCircuitName}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <ConstructorStandingsSection standings={constructorStandings} />

        <section className="feature-showcase" data-home-reveal>
          <div className="section-shell feature-showcase__header">
            <div className="section-meta">Products</div>
            <h2 className="section-title">Telemetry and strategy.</h2>
            <p className="section-copy">Four focused surfaces for race intelligence.</p>
          </div>

          <div className="module-grid feature-showcase__grid">
            <ModuleLink
              href="/analytics"
              index="01"
              state="Live"
              title="Analytics"
              summary="Telemetry comparison"
              visualTeamId="mercedes"
            />
            <ModuleLink
              href="/race-analysis"
              index="02"
              state="Live"
              title="Race Analysis"
              summary="Post-race intelligence"
              visualTeamId="ferrari"
            />
            <ModuleLink
              href="/lab"
              index="03"
              state="Live"
              title="Strategy Lab"
              summary="Scenario simulator"
              visualTeamId="red_bull"
            />
            <ModuleLink
              href="/predictions"
              index="04"
              state="Live"
              title="Race Week"
              summary="Next-race read"
              visualTeamId="mclaren"
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
