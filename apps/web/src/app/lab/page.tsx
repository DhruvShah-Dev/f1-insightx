import { RaceLabWorkspace } from "@/components/lab/race-lab-workspace";
import { AppHeader } from "@/components/ui/app-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { withServerFallback } from "@/lib/errors/logger";
import { getCircuitTrackData } from "@/lib/server/circuit-track-data";
import { getStrategyLabRaceProductResult, listStrategyLabRacesResult } from "@/lib/server/strategy-lab-product";

export default async function RaceLabPage() {
  const raceListResult = await withServerFallback(() => listStrategyLabRacesResult(), {
    mode: "unavailable" as const,
    data: null,
    meta: {
      surface: "strategy-lab" as const,
      mode: "unavailable" as const,
      sourceKind: null,
      sourceLabel: null,
      reason: "Strategy Lab race list failed to load.",
      generatedAt: null,
      buildVersion: null,
      eventId: null,
      season: null,
      round: null,
    },
  }, "page:lab:races");
  const races = raceListResult.mode === "unavailable" ? [] : raceListResult.data;
  const initialRaceResult = races[0] ? await getStrategyLabRaceProductResult(races[0].id) : null;
  const trackPaths = Object.fromEntries(
    await Promise.all(
      races.map(async (race) => [race.circuitId, (await getCircuitTrackData(race.circuitId))?.pathData ?? null] as const),
    ),
  );

  return (
    <main className="strategy-lab-page">
      <AppHeader title="Strategy Lab" actionHref="/analytics" actionLabel="Analytics" compact />

      {races.length > 0 ? (
        <RaceLabWorkspace
          races={races}
          trackPaths={trackPaths}
          initialProduct={initialRaceResult?.mode === "unavailable" ? null : initialRaceResult?.data ?? null}
          initialRuntime={initialRaceResult?.meta ?? null}
        />
      ) : (
        <div className="strategy-lab-page__empty">
          <StatePanel
            eyebrow="Strategy Lab"
            title={raceListResult.mode === "unavailable" ? "Strategy Lab is unavailable right now." : "No Strategy Lab races are available yet."}
            message={
              raceListResult.mode === "unavailable"
                ? "Strategy Lab data is missing or unavailable."
                : "Data ready races will appear here automatically."
            }
            tone="error"
            actionHref="/"
            actionLabel="Back to homepage"
          />
        </div>
      )}
      <SiteFooter />
    </main>
  );
}
