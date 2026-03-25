import { RaceHistoryCard } from "@/components/home/race-history-card";
import type { RaceHistorySummary } from "@/lib/server/race-history";

type RaceHistoryRailProps = {
  races: RaceHistorySummary[];
};

export function RaceHistoryRail({ races }: RaceHistoryRailProps) {
  if (races.length === 0) {
    return (
      <section className="section-shell">
        <div className="section-meta">Recent activity</div>
        <p className="section-copy">No completed race history is available yet.</p>
      </section>
    );
  }

  return (
    <section className="section-shell">
      <div className="race-history-header">
        <div>
          <div className="section-meta">Recent activity</div>
          <h2 className="section-title">Latest completed Grand Prix.</h2>
        </div>
        <p className="section-copy">
          Ordered newest to oldest so the most recent race outcomes stay close to the current standings.
        </p>
      </div>

      <div className="race-history-rail">
        {races.map((race) => (
          <RaceHistoryCard key={race.id} race={race} />
        ))}
      </div>
    </section>
  );
}
