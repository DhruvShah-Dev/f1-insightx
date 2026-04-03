import { FantasyWorkspace } from "@/components/fantasy/fantasy-workspace";
import { StatePanel } from "@/components/ui/state-panel";
import { HomeLink } from "@/components/ui/home-link";
import { withServerFallback } from "@/lib/errors/logger";
import { getRaceWeekOverview } from "@/lib/server/f1-platform";

export default async function FantasyPage() {
  const overview = await withServerFallback(() => getRaceWeekOverview(), null, "page:fantasy:race-week");
  const season = overview?.nextRace?.season ?? overview?.latestCompletedRace?.season ?? 2026;

  return (
    <main className="subpage-shell">
      <header className="subpage-header">
        <div>
          <p className="subpage-eyebrow">Fantasy Team Builder</p>
          <h1 className="subpage-title">Constraint-based lineup optimizer.</h1>
        </div>
        <HomeLink />
      </header>

      <section className="section-shell">
        <div className="section-meta">Engine</div>
        <p className="section-copy">
          Searches valid lineups under budget and scores them from the current race-week prediction baseline.
        </p>
      </section>

      {season ? (
        <FantasyWorkspace season={season} />
      ) : (
        <StatePanel
          eyebrow="Fantasy Builder"
          title="Fantasy data is not ready yet."
          message="The optimizer needs a race-week context before it can build a lineup."
          tone="notice"
          actionHref="/"
          actionLabel="Back to homepage"
        />
      )}
    </main>
  );
}
