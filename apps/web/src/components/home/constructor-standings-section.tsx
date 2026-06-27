import { ConstructorStandingCard } from "@/components/home/constructor-standing-card";
import { AssetImage } from "@/components/ui/asset-image";
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
};

function ConstructorOrderRow({ standing }: ConstructorOrderRowProps) {
  const team = getTeamAsset(standing.constructorId);
  const plate = team.badgePlate ?? "default";

  return (
    <li
      className={`constructor-order-row constructor-order-row--${plate}`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
          "--team-logo-contrast": team.badgeContrastColor ?? team.secondary,
        } as CSSProperties
      }
    >
      <span className="constructor-order-row__rank">P{standing.standingPosition}</span>
      <span className="constructor-order-row__team">
        <span className={`constructor-order-row__logo-plate constructor-order-row__logo-plate--${plate}`} aria-hidden="true">
          {team.badgeAssetPath ? (
            <AssetImage
              src={team.badgeAssetPath}
              fallbackSrc={team.fallbackImagePath}
              alt=""
              fill
              className="constructor-order-row__logo"
              sizes="54px"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <span className="constructor-order-row__logo-fallback">{team.shortLabel}</span>
          )}
        </span>
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
                />
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
