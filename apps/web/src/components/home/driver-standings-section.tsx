import { DriverStandingCard } from "@/components/home/driver-standing-card";
import type { CurrentSeasonDriverStandings } from "@/lib/server/standings";

type DriverStandingsSectionProps = {
  standings: CurrentSeasonDriverStandings | null;
};

export function DriverStandingsSection({ standings }: DriverStandingsSectionProps) {
  if (!standings || standings.items.length === 0) {
    return (
      <section className="driver-standings">
        <div className="section-shell">
          <div className="section-meta">Live context</div>
          <p className="section-copy">Standings will appear once completed race data is available for the active season.</p>
        </div>
      </section>
    );
  }

  const updatedAt = new Date(standings.latestRaceDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <section className="driver-standings">
      <div className="section-shell">
        <div className="section-meta">Live context</div>
        <div className="driver-standings__header">
          <div>
            <h2 className="section-title">Driver standings.</h2>
            <p className="section-copy">
              {standings.season} championship order after {standings.latestRaceName}, updated through {updatedAt}.
            </p>
          </div>
        </div>
      </div>

      <div className="driver-standings__grid" aria-label={`${standings.season} driver standings`}>
        {standings.items.map((standing, index) => (
          <DriverStandingCard
            key={standing.driverId}
            standing={standing}
            priority={index < 6}
          />
        ))}
      </div>
    </section>
  );
}
