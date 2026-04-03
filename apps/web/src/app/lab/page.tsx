import { RaceLabWorkspace } from "@/components/lab/race-lab-workspace";
import { StatePanel } from "@/components/ui/state-panel";
import { HomeLink } from "@/components/ui/home-link";
import { withServerFallback } from "@/lib/errors/logger";
import { listRaces } from "@/lib/server/reference-data";

export default async function RaceLabPage() {
  const races = await withServerFallback(() => listRaces({ limit: 48 }), [], "page:lab:races");

  return (
    <main className="subpage-shell">
      <header className="subpage-header subpage-header--lab">
        <div className="subpage-header__bar">
          <p className="subpage-eyebrow">Strategy Lab</p>
          <HomeLink />
        </div>
        <div className="subpage-header__copy subpage-header__copy--lab">
          <div>
            <h1 className="subpage-title">Build one race plan. Compare it against the field.</h1>
            <p className="race-detail__lede">
              Strategy Lab isolates one driver or constructor, keeps the rest of the race stable, and returns a focused comparison brief instead of a broad prediction dump.
            </p>
          </div>
          <div className="strategy-header-summary" aria-label="Strategy Lab workflow summary">
            <div className="strategy-header-summary__item">
              <span>Target</span>
              <strong>Choose one driver or constructor</strong>
            </div>
            <div className="strategy-header-summary__item">
              <span>Scenario</span>
              <strong>Adjust tires, stops, pressure, and weather</strong>
            </div>
            <div className="strategy-header-summary__item">
              <span>Output</span>
              <strong>Read one clear delta against the field baseline</strong>
            </div>
          </div>
        </div>
      </header>

      {races.length > 0 ? (
        <RaceLabWorkspace races={races} />
      ) : (
        <StatePanel
          eyebrow="Strategy Lab"
          title="The Strategy Lab could not load race options."
          message="Race weekends are unavailable right now, so the simulator cannot build a scenario yet."
          tone="error"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      )}
    </main>
  );
}
