import { ConstructorStandingCard } from "@/components/home/constructor-standing-card";
import type { ConstructorStanding } from "@/lib/server/standings";

type ConstructorStandingsData = {
  season: number;
  latestRaceId: string;
  latestRaceName: string;
  latestRaceDate: string;
  items: ConstructorStanding[];
} | null;

type ConstructorStandingsSectionProps = {
  standings: ConstructorStandingsData;
  hideHeader?: boolean;
};

export function ConstructorStandingsSection({
  standings,
  hideHeader = false,
}: ConstructorStandingsSectionProps) {
  if (!standings || standings.items.length === 0) {
    return (
      <section className="constructor-standings">
        {hideHeader ? (
          <p className="section-copy">Constructors standings unavailable.</p>
        ) : (
          <div className="section-shell">
            <div className="section-meta">Constructors Championship</div>
            <p className="section-copy">Constructors standings unavailable.</p>
          </div>
        )}
      </section>
    );
  }

  const sortedItems = [...standings.items].sort(
    (left, right) => right.points - left.points || left.standingPosition - right.standingPosition,
  );
  const [p1, p2, ...remaining] = sortedItems;
  const rowTwo = remaining.slice(0, 4);
  const rowThree = remaining.slice(4, 9);

  return (
    <section className="constructor-standings">
      <article className="constructor-standings__intro championship-intro championship-intro--constructors">
        <div className="championship-intro__content">
          <h2 className="section-title">Constructors Championship</h2>
          <span className="section-meta">2026</span>
          <p className="championship-intro__description">Team order across the 2026 season.</p>
        </div>
      </article>

      <div className="constructor-standings__board" aria-label={`${standings.season} constructor standings`}>
        <div className="constructor-standings__row constructor-standings__row--hero">
          {p1 ? (
            <div className="constructor-standings__cell">
              <ConstructorStandingCard
                key={p1.constructorId}
                standing={p1}
                priority
              />
            </div>
          ) : (
            <div className="constructor-standings__cell constructor-standings__cell--empty" aria-hidden="true" />
          )}

          {p2 ? (
            <div className="constructor-standings__cell">
              <ConstructorStandingCard
                key={p2.constructorId}
                standing={p2}
                priority
              />
            </div>
          ) : (
            <div className="constructor-standings__cell constructor-standings__cell--empty" aria-hidden="true" />
          )}
        </div>

        <div className="constructor-standings__row constructor-standings__row--top-four">
          {rowTwo.map((standing) => (
            <div
              key={standing.constructorId}
              className="constructor-standings__cell"
            >
              <ConstructorStandingCard
                standing={standing}
                priority={standing.standingPosition <= 4}
              />
            </div>
          ))}
        </div>

        <div className="constructor-standings__row constructor-standings__row--rest">
          {rowThree.map((standing) => (
            <div
              key={standing.constructorId}
              className="constructor-standings__cell"
            >
              <ConstructorStandingCard standing={standing} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
