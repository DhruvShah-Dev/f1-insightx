import { ConstructorStandingsSection } from "@/components/home/constructor-standings-section";
import { DriverStandingsSection } from "@/components/home/driver-standings-section";
import { HomeScrollReveal } from "@/components/home/home-scroll-reveal";
import { HomeHero } from "@/components/home/home-hero";
import { MainPageBackground } from "@/components/home/main-page-background";
import { ModuleLink } from "@/components/home/module-link";
import { RaceHistoryRail } from "@/components/home/race-history-rail";
import { AppFooter } from "@/components/ui/app-footer";
import { listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import type { RaceHistorySummary } from "@/lib/server/race-history";
import { listCompletedRaceHistory } from "@/lib/server/race-history";
import { getSeasonState } from "@/lib/server/season-state";
import { getCurrentSeasonConstructorStandings, getCurrentSeasonDriverStandings } from "@/lib/server/standings";
import { makeMetadata } from "@/lib/seo";
import { getCircuitAsset, getTeamAsset } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMetaByCode } from "@/lib/ui/driver-asset-manifest";
import { getCircuitDisplayName } from "@/lib/ui/home-hero";

export const metadata = makeMetadata({
  description:
    "F1 InsightX turns Formula 1 telemetry, standings, race history, and race-week signals into prediction, strategy, and post-race intelligence.",
  keywords: ["F1 standings", "F1 race intelligence", "F1 race week"],
});

type RaceAnalysisIndexItem = Awaited<ReturnType<typeof listRaceAnalysisIndex>>[number];

function mergeLatestCompletedRace(
  races: RaceHistorySummary[],
  latestRace: NonNullable<Awaited<ReturnType<typeof getSeasonState>>>["latest_completed_race_with_results"] | null | undefined,
  analysisIndex: RaceAnalysisIndexItem[],
  limit: number,
) {
  if (
    !latestRace?.id ||
    latestRace.season === null ||
    latestRace.round === null ||
    !latestRace.race_name ||
    !latestRace.circuit_id ||
    races.some((race) => race.id === latestRace.id)
  ) {
    return races;
  }

  const analysisRace = analysisIndex.find((race) => race.id === latestRace.id);
  const circuit = getCircuitAsset(latestRace.circuit_id);
  const winnerDriver = getCurrentDriverMetaByCode(analysisRace?.winner);
  const winnerTeam = getTeamAsset(analysisRace?.winnerTeam);
  const latestSummary: RaceHistorySummary = {
    id: latestRace.id,
    slug: latestRace.id,
    season: latestRace.season,
    round: latestRace.round,
    grandPrixName: latestRace.race_name,
    displayName: latestRace.race_name,
    circuitId: latestRace.circuit_id,
    circuitName: circuit.displayName,
    country: null,
    raceDate: latestRace.scheduled_at ?? analysisRace?.raceDate ?? "",
    winner: analysisRace?.winner
      ? {
          driverId: winnerDriver.driverId,
          driverName: winnerDriver.displayName,
          constructorId: winnerTeam.id,
          constructorName: winnerTeam.label,
        }
      : null,
  };

  return [latestSummary, ...races]
    .sort((left, right) => new Date(right.raceDate).getTime() - new Date(left.raceDate).getTime())
    .slice(0, limit);
}

export default async function Home() {
  const raceHistoryLimit = 10;
  const [constructorStandings, raceHistory, driverStandings, raceAnalysisIndex] = await Promise.all([
    getCurrentSeasonConstructorStandings(),
    listCompletedRaceHistory(raceHistoryLimit),
    getCurrentSeasonDriverStandings(),
    listRaceAnalysisIndex(),
  ]);
  const seasonState = await getSeasonState();
  const recentRaceHistory = mergeLatestCompletedRace(
    raceHistory,
    seasonState?.latest_completed_race_with_results ?? seasonState?.latest_completed_race,
    raceAnalysisIndex,
    raceHistoryLimit,
  );
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
            <h2 className="section-title">Explore</h2>
          </div>

          <div className="module-grid feature-showcase__grid">
            <ModuleLink
              href="/predictions"
              index="01"
              title="Race Week"
              summary="Next-race intelligence"
              icon="forecast"
              variant="band"
            />
            <ModuleLink
              href="/picks"
              index="02"
              title="Picks"
              summary="Lock race calls"
              icon="picks"
              variant="band"
            />
            <ModuleLink
              href="/race-analysis"
              index="03"
              title="Race Analysis"
              summary="Post-race telemetry"
              icon="analysis"
              variant="band"
            />
            <ModuleLink
              href="/championship"
              index="04"
              title="Championship"
              summary="Season standings"
              icon="championship"
              variant="band"
            />
          </div>
        </section>

        <ConstructorStandingsSection standings={constructorStandings} />

        <RaceHistoryRail races={recentRaceHistory} />
        <DriverStandingsSection standings={driverStandings} />

        <AppFooter />
      </div>
    </main>
  );
}
