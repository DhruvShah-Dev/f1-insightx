import { RaceLabWorkspace } from "@/components/lab/race-lab-workspace";
import { AppHeader } from "@/components/ui/app-header";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { withServerFallback } from "@/lib/errors/logger";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { listStrategyLabRacesResult } from "@/lib/server/strategy-lab-product";

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
  const seasonState = await getSeasonState();
  const races = raceListResult.mode === "unavailable" ? [] : raceListResult.data;
  const activeRace = races[0] ?? null;
  const strategyLatest = seasonState?.strategy_lab_available.latest_race;
  const nextRace = seasonState?.next_race;

  return (
    <main className="strategy-lab-page">
      <AppHeader title="Strategy Lab" actionHref="/analytics" actionLabel="Analytics" compact />
      <header className="strategy-lab-page__hero">
        <div className="strategy-lab-page__hero-body">
          <div className="strategy-lab-page__hero-copy">
            <p className="strategy-lab-page__eyebrow">Race strategy playground</p>
            <h1 className="strategy-lab-page__title">Scenario the race before the lights go out.</h1>
            <p className="strategy-lab-page__lede">Build a race shape and read finish bands, pit windows, and key drivers.</p>
          </div>

          <div className="strategy-lab-page__hero-rail" aria-label="Strategy Lab overview">
            <div className="strategy-lab-page__hero-card">
              <span>Strategy build</span>
              <strong>{strategyLatest ? formatSeasonRaceLabel(strategyLatest) : activeRace?.raceName ?? "No race loaded"}</strong>
              <p>{seasonState?.strategy_lab_available.next_race_available ? "Aligned with next race." : `${formatSeasonRaceLabel(nextRace)} pending.`}</p>
            </div>
            <div className="strategy-lab-page__hero-card">
              <span>Dataset</span>
              <strong>{races.length} race{races.length === 1 ? "" : "s"} ready</strong>
              <p>
                {raceListResult.mode === "degraded"
                  ? "Backup data source is active."
                  : "Data ready races are selectable."}
              </p>
              <ProductRuntimeNote runtime={raceListResult.meta} className="strategy-lab-page__runtime" primaryLabel="Strategy Lab data" degradedLabel="Backup data source" />
            </div>
            <div className="strategy-lab-page__hero-card">
              <span>Season state</span>
              <strong>{formatSeasonRaceLabel(seasonState?.latest_completed_race)}</strong>
              <p>{seasonState?.missing_data_flags.includes("latest_completed_results_missing") ? "Latest results pending." : "Results aligned."}</p>
            </div>
          </div>
        </div>
      </header>

      {races.length > 0 ? (
        <RaceLabWorkspace races={races} />
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
