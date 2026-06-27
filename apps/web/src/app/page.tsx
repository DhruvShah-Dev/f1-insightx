import { ConstructorStandingsSection } from "@/components/home/constructor-standings-section";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { HomeScrollReveal } from "@/components/home/home-scroll-reveal";
import { HomeHero } from "@/components/home/home-hero";
import { MainPageBackground } from "@/components/home/main-page-background";
import { ModuleLink } from "@/components/home/module-link";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { AppFooter } from "@/components/ui/app-footer";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getSeasonState } from "@/lib/server/season-state";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";
import { getCircuitDisplayName } from "@/lib/ui/home-hero";

export default async function Home() {
  const [constructorStandings, raceHistory, driverStandings] = await Promise.all([
    getCurrentSeasonConstructorStandings(),
    listCompletedRaceHistory(10),
    getCurrentSeasonDriverStandings(),
  ]);
  const seasonState = await getSeasonState();
  const nextRace = seasonState?.next_race ?? null;
  const nextRaceCircuitName = getCircuitDisplayName(nextRace?.circuit_id);
  const leadingConstructorId = constructorStandings?.items
    .slice()
    .sort((left, right) => left.standingPosition - right.standingPosition)[0]?.constructorId ?? "mercedes";

  return (
    <main className="home-shell">
      <MainPageBackground />
      <HomeScrollReveal />

      <div className="home-shell__content">
        <HomeHero nextRace={nextRace} circuitName={nextRaceCircuitName} visualTeamId={leadingConstructorId} />

        <section className="feature-showcase" data-home-reveal>
          <div className="section-shell feature-showcase__header">
            <div className="section-meta">Products</div>
            <h2 className="section-title">Telemetry and strategy.</h2>
          </div>

          <div className="module-grid feature-showcase__grid">
            <ModuleLink
              href="/race-analysis"
              index="01"
              title="Race Analysis"
              summary="Cinematic post-race analytics"
              visualTeamId="mercedes"
              variant="band"
            />
            <ModuleLink
              href="/lab"
              index="02"
              title="Strategy Lab"
              summary="Scenario simulator"
              visualTeamId="ferrari"
              variant="band"
            />
            <ModuleLink
              href="/predictions"
              index="03"
              title="Race Week"
              summary="Next-race read"
              visualTeamId="red_bull"
              variant="band"
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
