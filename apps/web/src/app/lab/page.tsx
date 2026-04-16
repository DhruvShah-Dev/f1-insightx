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
            <h1 className="subpage-title">Scenario the race before the lights go out.</h1>
            <p className="race-detail__lede">
              Strategy Lab turns the race-week priors into a scenario experience: choose the race shape, aim it at one target, then read the projection as a race story instead of a simulation dump.
            </p>
          </div>
          <div className="strategy-header-summary" aria-label="Strategy Lab workflow summary">
            <div className="strategy-header-summary__item">
              <span>Setup</span>
              <strong>Start with the race shape</strong>
            </div>
            <div className="strategy-header-summary__item">
              <span>Compare</span>
              <strong>Read finish bands and risk</strong>
            </div>
            <div className="strategy-header-summary__item">
              <span>Narrative</span>
              <strong>Understand why the call works</strong>
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
