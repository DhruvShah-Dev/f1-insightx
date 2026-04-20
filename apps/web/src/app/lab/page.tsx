import { RaceLabWorkspace } from "@/components/lab/race-lab-workspace";
import { HomeLink } from "@/components/ui/home-link";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { StatePanel } from "@/components/ui/state-panel";
import { withServerFallback } from "@/lib/errors/logger";
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
  const races = raceListResult.mode === "unavailable" ? [] : raceListResult.data;
  const activeRace = races[0] ?? null;

  return (
    <main className="strategy-lab-page">
      <header className="strategy-lab-page__hero">
        <div className="strategy-lab-page__topbar">
          <div className="strategy-lab-page__kicker">
            <span>Strategy Lab</span>
            <strong>Flagship simulation surface</strong>
          </div>
          <HomeLink />
        </div>

        <div className="strategy-lab-page__hero-body">
          <div className="strategy-lab-page__hero-copy">
            <p className="strategy-lab-page__eyebrow">Race strategy playground</p>
            <h1 className="strategy-lab-page__title">Scenario the race before the lights go out.</h1>
            <p className="strategy-lab-page__lede">
              Build a race shape, push it against the field baseline, and read the outcome as a finish range, pit window, and strategy narrative instead of a timing dump.
            </p>
          </div>

          <div className="strategy-lab-page__hero-rail" aria-label="Strategy Lab overview">
            <div className="strategy-lab-page__hero-card">
              <span>Active race</span>
              <strong>{activeRace?.raceName ?? "No race loaded"}</strong>
              <p>{activeRace ? `${activeRace.season} Round ${activeRace.round} · ${activeRace.circuitName}` : "Strategy Lab is waiting on a materialized race product."}</p>
            </div>
            <div className="strategy-lab-page__hero-card">
              <span>Dataset</span>
              <strong>{races.length} race{races.length === 1 ? "" : "s"} ready</strong>
              <p>
                {raceListResult.mode === "degraded"
                  ? "Only materialized Strategy Lab races are available while the page is serving from the fallback product snapshot."
                  : "Only materialized Strategy Lab races are selectable, so the page only serves product-backed weekends."}
              </p>
              <ProductRuntimeNote runtime={raceListResult.meta} className="strategy-lab-page__runtime" primaryLabel="Primary Strategy Lab list" degradedLabel="Fallback Strategy Lab list" />
            </div>
            <div className="strategy-lab-page__hero-card">
              <span>Outcome</span>
              <strong>Scenario-first UX</strong>
              <p>Controls, projection, pit windows, confidence, and explanation now read as one connected race story.</p>
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
                ? "The Strategy Lab product layer is missing or unavailable. Restore the product views or the explicit CSV fallback to bring this surface back."
                : "The race list is now sourced from the Strategy Lab product layer itself. Once a race is materialized into strategy views, it will appear here automatically."
            }
            tone="error"
            actionHref="/"
            actionLabel="Back to homepage"
          />
        </div>
      )}
    </main>
  );
}
