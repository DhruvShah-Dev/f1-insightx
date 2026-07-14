import Link from "next/link";
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
  const podiumTeams = sortedItems.slice(0, 3);

  return (
    <section className="constructor-standings" data-home-reveal>
      <article className="constructor-standings__intro championship-intro championship-intro--constructors">
        <div className="championship-intro__content">
          <h2 className="section-title">Constructors Championship</h2>
          <span className="championship-intro__season">{standings.season}</span>
        </div>
      </article>

      <div className="constructor-standings__board" aria-label={`${standings.season} constructor standings`}>
        <div className="constructor-standings__podium" aria-label="Top three constructors">
          {podiumTeams.map((standing, index) => (
            <div
              key={standing.constructorId}
              className={`constructor-standings__podium-cell constructor-standings__podium-cell--p${index + 1}`}
            >
              <ConstructorStandingCard
                standing={standing}
                priority={index < 3}
                variant={index === 0 ? "leader" : "podium"}
              />
            </div>
          ))}
        </div>

        <div className="championship-preview__actions">
          <Link href="/championship#constructors" className="hero__cta hero__cta--secondary">
            More constructors
          </Link>
        </div>
      </div>
    </section>
  );
}
