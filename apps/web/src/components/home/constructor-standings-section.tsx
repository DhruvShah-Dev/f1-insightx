import { ConstructorStandingCard } from "@/components/home/constructor-standing-card";
import type { ConstructorStanding } from "@/lib/server/standings";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import type { CSSProperties } from "react";

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

type ConstructorOrderRowProps = {
  standing: ConstructorStanding;
  leaderPoints: number;
};

function ConstructorOrderRow({ standing, leaderPoints }: ConstructorOrderRowProps) {
  const team = getTeamAsset(standing.constructorId);
  const gap = Math.max(0, leaderPoints - standing.points);

  return (
    <li
      className="constructor-order-row"
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
        } as CSSProperties
      }
    >
      <span className="constructor-order-row__rank">P{standing.standingPosition}</span>
      <span className="constructor-order-row__team">
        <span className="constructor-order-row__code">{team.shortLabel}</span>
        <strong>{team.label}</strong>
      </span>
      <span className="constructor-order-row__metric">
        <small>Points</small>
        <strong>{standing.points}</strong>
      </span>
      <span className="constructor-order-row__metric">
        <small>Wins</small>
        <strong>{standing.wins}</strong>
      </span>
      <span className="constructor-order-row__gap">
        <small>Gap</small>
        <strong>{gap === 0 ? "Leader" : `-${gap}`}</strong>
      </span>
    </li>
  );
}

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
  const fieldTeams = sortedItems.slice(3);
  const leaderPoints = podiumTeams[0]?.points ?? 0;

  return (
    <section className="constructor-standings">
      <article className="constructor-standings__intro championship-intro championship-intro--constructors">
        <div className="championship-intro__content">
          <h2 className="section-title">Constructors Championship</h2>
          <span className="championship-intro__season">{standings.season}</span>
          <p className="championship-intro__description">After {standings.latestRaceName}</p>
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

        {fieldTeams.length > 0 ? (
          <div className="constructor-standings__field-board">
            <div className="constructor-standings__field-header">
              <span>Constructor order</span>
              <strong>P4-P{sortedItems.length}</strong>
            </div>
            <ol className="constructor-standings__field-list" aria-label="Constructor order from fourth place">
              {fieldTeams.map((standing) => (
                <ConstructorOrderRow
                  key={standing.constructorId}
                  standing={standing}
                  leaderPoints={leaderPoints}
                />
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
