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

  const [p1, p2, ...remaining] = standings.items;
  const rows = [
    remaining.slice(0, 5),
    remaining.slice(5, 10),
    remaining.slice(10, 15),
    remaining.slice(15, 20),
  ];

  return (
    <section className="driver-standings">
      <article className="driver-standings__intro championship-intro championship-intro--drivers">
        <div className="championship-intro__content">
          <h2 className="section-title">
            <span>Drivers</span>
            <span>Championship</span>
          </h2>
          <span className="section-meta">2026</span>
          <p className="championship-intro__description">Championship momentum across the 2026 grid.</p>
        </div>
      </article>

      <div className="driver-standings__board" aria-label={`${standings.season} driver standings`}>
        <div className="driver-standings__row driver-standings__row--hero">
          {p1 ? (
            <div className="driver-standings__cell">
              <DriverStandingCard standing={p1} priority />
            </div>
          ) : (
            <div className="driver-standings__cell driver-standings__cell--empty" aria-hidden="true" />
          )}

          {p2 ? (
            <div className="driver-standings__cell">
              <DriverStandingCard standing={p2} priority />
            </div>
          ) : (
            <div className="driver-standings__cell driver-standings__cell--empty" aria-hidden="true" />
          )}
        </div>

        {rows.map((row, rowIndex) => (
          row.length > 0 ? (
            <div key={`driver-row-${rowIndex + 1}`} className="driver-standings__row driver-standings__row--pack">
              {row.map((standing, index) => (
                <div key={standing.driverId} className="driver-standings__cell">
                  <DriverStandingCard
                    standing={standing}
                    priority={rowIndex === 0 && index < 4}
                  />
                </div>
              ))}
            </div>
          ) : null
        ))}
      </div>
    </section>
  );
}
