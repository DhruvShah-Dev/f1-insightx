import Link from "next/link";
import { DriverStandingCard } from "@/components/home/driver-standing-card";
import type { CurrentSeasonDriverStandings } from "@/lib/server/standings";

type DriverStandingsSectionProps = {
  standings: CurrentSeasonDriverStandings | null;
  hideHeader?: boolean;
};

export function DriverStandingsSection({ standings, hideHeader = false }: DriverStandingsSectionProps) {
  if (!standings || standings.items.length === 0) {
    return (
      <section className="driver-standings">
        {hideHeader ? (
          <p className="section-copy">Drivers standings unavailable.</p>
        ) : (
          <div className="section-shell">
            <div className="section-meta">Drivers Championship</div>
            <p className="section-copy">Drivers standings unavailable.</p>
          </div>
        )}
      </section>
    );
  }

  const topDrivers = standings.items
    .slice()
    .sort((left, right) => right.points - left.points || left.standingPosition - right.standingPosition)
    .slice(0, 3);

  return (
    <section className="driver-standings" data-home-reveal>
      <article className="driver-standings__intro championship-intro championship-intro--drivers">
        <div className="championship-intro__content">
          <h2 className="section-title">Drivers Championship</h2>
          <span className="championship-intro__season">{standings.season}</span>
          <p className="championship-intro__description">After {standings.latestRaceName}</p>
        </div>
      </article>

      <div className="driver-standings__board" aria-label={`${standings.season} driver standings`}>
        <div className="driver-standings__leaders" aria-label="Top three drivers">
          {topDrivers.map((standing) => (
            <div className="driver-standings__cell" key={standing.driverId}>
              <DriverStandingCard standing={standing} priority={standing.standingPosition <= 3} />
            </div>
          ))}
        </div>

        <div className="championship-preview__actions">
          <Link href="/championship#drivers" className="hero__cta hero__cta--secondary">
            More drivers
          </Link>
        </div>
      </div>
    </section>
  );
}
