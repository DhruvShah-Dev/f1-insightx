import { DriverStandingCard } from "@/components/home/driver-standing-card";
import { VerticalScrollList } from "@/components/home/vertical-scroll-list";
import { AssetImage } from "@/components/ui/asset-image";
import type { CSSProperties } from "react";
import type { CurrentSeasonDriverStandings, DriverStanding } from "@/lib/server/standings";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

type DriverStandingsSectionProps = {
  standings: CurrentSeasonDriverStandings | null;
  hideHeader?: boolean;
};

function DriverOrderRow({ standing }: { standing: DriverStanding }) {
  const team = getTeamAsset(standing.teamId);
  const driver = getCurrentDriverMeta(standing.driverId);

  return (
    <li
      className="driver-order-row"
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
        } as CSSProperties
      }
    >
      <strong className="driver-order-row__rank">P{standing.standingPosition}</strong>
      <span className="driver-order-row__identity">
        <small>{team.label}</small>
        <strong>{standing.displayName}</strong>
      </span>
      <span className="driver-order-row__portrait" aria-hidden="true">
        <AssetImage
          src={driver.photoPath ?? driver.fallbackPhotoPath}
          fallbackSrc={driver.fallbackPhotoPath}
          alt=""
          className="driver-order-row__image"
          fill
          sizes="5rem"
          style={{
            objectFit: driver.photoFit ?? "cover",
            objectPosition: driver.photoPosition ?? "center top",
            transform: `scale(${driver.photoScale ?? 1})`,
          }}
        />
      </span>
      <span className="driver-order-row__points"><small>Points</small><strong>{standing.points}</strong></span>
    </li>
  );
}

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
  return (
    <section className="driver-standings">
      <article className="driver-standings__intro championship-intro championship-intro--drivers">
        <div className="championship-intro__content">
          <h2 className="section-title">Drivers Championship</h2>
          <span className="championship-intro__season">{standings.season}</span>
          <p className="championship-intro__description">After {standings.latestRaceName}</p>
        </div>
      </article>

      <div className="driver-standings__board" aria-label={`${standings.season} driver standings`}>
        <div className="driver-standings__leaders">
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

        <div className="driver-standings__order-board">
          <div className="driver-standings__order-header"><span>Position</span><span>Points</span></div>
          <VerticalScrollList className="driver-standings__order-list" ariaLabel="Driver standings from third place">
            {remaining.map((standing) => <DriverOrderRow key={standing.driverId} standing={standing} />)}
          </VerticalScrollList>
        </div>
      </div>
    </section>
  );
}
