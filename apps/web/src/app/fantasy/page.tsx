import { FantasyWorkspace } from "@/components/fantasy/fantasy-workspace";
import { StatePanel } from "@/components/ui/state-panel";
import { AppHeader } from "@/components/ui/app-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { withServerFallback } from "@/lib/errors/logger";
import { getRaceWeekOverview } from "@/lib/server/f1-platform";

export default async function FantasyPage() {
  const overview = await withServerFallback(() => getRaceWeekOverview(), null, "page:fantasy:race-week");
  const season = overview?.nextRace?.season ?? overview?.latestCompletedRace?.season ?? 2026;

  return (
    <main className="subpage-shell">
      <AppHeader title="Fantasy Builder" actionHref="/predictions" actionLabel="Race Week" compact />
      <header className="subpage-header">
        <div>
          <p className="subpage-eyebrow">Fantasy Team Builder</p>
          <h1 className="subpage-title">Constraint-based lineup optimizer.</h1>
        </div>
      </header>

      <section className="section-shell">
        <div className="section-meta">Engine</div>
        <p className="section-copy">Build valid lineups from the current Race Week baseline.</p>
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
      <SiteFooter />
    </main>
  );
}
