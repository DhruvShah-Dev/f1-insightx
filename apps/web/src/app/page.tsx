import Link from "next/link";
import { ConstructorStandingsSection } from "@/components/home/constructor-standings-section";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { HomeScrollReveal } from "@/components/home/home-scroll-reveal";
import { MainPageBackground } from "@/components/home/main-page-background";
import { ModuleLink } from "@/components/home/module-link";
import { RaceCountdown } from "@/components/home/race-countdown";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { AppFooter } from "@/components/ui/app-footer";
import { TrackMap } from "@/components/ui/track-map";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getSeasonState, type SeasonRaceRef } from "@/lib/server/season-state";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";

const CIRCUIT_DISPLAY_NAMES: Record<string, string> = {
  catalunya: "Circuit de Barcelona-Catalunya",
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
  const [constructorStandings, raceHistory, driverStandings] = await Promise.all([
    getCurrentSeasonConstructorStandings(),
    listCompletedRaceHistory(10),
    getCurrentSeasonDriverStandings(),
  ]);
  const seasonState = await getSeasonState();
  const nextRace = seasonState?.next_race ?? null;
  const nextRaceCircuitName = getCircuitDisplayName(nextRace);

  return (
    <main className="home-shell">
      <MainPageBackground />
      <HomeScrollReveal />

      <div className="home-shell__content">
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
                    <p>
                      <RaceCountdown
                        scheduledAt={nextRace.scheduled_at}
                        initialLabel={formatCountdown(nextRace.scheduled_at)}
                      />
                    </p>
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

        <section className="feature-showcase" data-home-reveal>
          <div className="section-shell feature-showcase__header">
            <div className="section-meta">Products</div>
            <h2 className="section-title">Telemetry and strategy.</h2>
          </div>

          <div className="module-grid feature-showcase__grid">
            <ModuleLink
              href="/analytics"
              index="01"
              title="Analytics"
              summary="Telemetry comparison"
              visualTeamId="mercedes"
            />
            <ModuleLink
              href="/race-analysis"
              index="02"
              title="Race Analysis"
              summary="Post-race intelligence"
              visualTeamId="ferrari"
            />
            <ModuleLink
              href="/lab"
              index="03"
              title="Strategy Lab"
              summary="Scenario simulator"
              visualTeamId="red_bull"
            />
            <ModuleLink
              href="/predictions"
              index="04"
              title="Race Week"
              summary="Next-race read"
              visualTeamId="mclaren"
            />
          </div>
        </section>

        <ConstructorStandingsSection standings={constructorStandings} />

        <RaceHistoryRail races={raceHistory} />
        <DriverStandingsSection standings={driverStandings} />

        <AppFooter />
      </div>
    </main>
  );
}
