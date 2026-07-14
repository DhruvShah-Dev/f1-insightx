import { RaceHistoryCard } from "@/components/home/race-history-card";
import { HorizontalScrollRail } from "@/components/home/horizontal-scroll-rail";
import type { RaceHistorySummary } from "@/lib/server/race-history";

type RaceHistoryRailProps = {
  races: RaceHistorySummary[];
  hideHeader?: boolean;
};

export function RaceHistoryRail({ races, hideHeader = false }: RaceHistoryRailProps) {
  if (races.length === 0) {
    return (
      <section className="section-shell home-story home-story--archive">
        {hideHeader ? (
          <p className="section-copy">Race archive unavailable.</p>
        ) : (
          <div className="home-story__lead">
            <div className="section-meta">Archive</div>
            <h2 className="section-title">Recent Grands Prix.</h2>
            <p className="section-copy">Race archive unavailable.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="section-shell home-story home-story--archive">
      {hideHeader ? null : (
        <div className="home-story__lead race-history-header">
          <div className="section-meta">Archive</div>
          <h2 className="section-title">Recent Grands Prix.</h2>
        </div>
      )}

      <div className="home-story__body">
        <div className="race-history-rail-shell">
          <HorizontalScrollRail className="race-history-rail" ariaLabel="Recent Grands Prix, horizontally scrollable">
            {races.map((race) => <RaceHistoryCard key={race.id} race={race} />)}
          </HorizontalScrollRail>
        </div>
      </div>
    </section>
  );
}
