import { AssetImage } from "@/components/ui/asset-image";
import type { CSSProperties } from "react";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import type { DriverStanding } from "@/lib/server/standings";

type DriverStandingCardProps = {
  standing: DriverStanding;
  priority?: boolean;
};

export function DriverStandingCard({ standing, priority = false }: DriverStandingCardProps) {
  const team = getTeamAsset(standing.teamId);
  const driver = getCurrentDriverMeta(standing.driverId);
  const teamLabel = team.label;

  return (
    <article
      className="driver-standing-card"
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
        } as CSSProperties
      }
    >
      <div className="driver-standing-card__sheen" aria-hidden="true" />
      <div className="driver-standing-card__layout">
        <div className="driver-standing-card__stat-rail" aria-label={`Position ${standing.standingPosition}, ${standing.points} points`}>
          <div className="driver-standing-card__stat">
            <span className="driver-standing-card__stat-label">Position</span>
            <strong className="driver-standing-card__stat-value">P{standing.standingPosition}</strong>
          </div>
          <div className="driver-standing-card__stat-divider" aria-hidden="true" />
          <div className="driver-standing-card__stat">
            <span className="driver-standing-card__stat-label">Points</span>
            <strong className="driver-standing-card__stat-value">{standing.points}</strong>
          </div>
        </div>

        <div className="driver-standing-card__main">
          <div className="driver-standing-card__intro">
            <p className="driver-standing-card__team">{teamLabel}</p>
            <h3 className="driver-standing-card__name">{standing.displayName}</h3>
          </div>

          <div className="driver-standing-card__portrait">
            <div className="driver-standing-card__portrait-frame">
              <div className="driver-standing-card__halo" aria-hidden="true" />
              <AssetImage
                src={driver.photoPath ?? driver.fallbackPhotoPath}
                fallbackSrc={driver.fallbackPhotoPath}
                alt={driver.altText}
                className="driver-standing-card__photo"
                fill
                sizes="(max-width: 959px) 100vw, 18rem"
                priority={priority}
                style={{
                  objectPosition: driver.photoPosition ?? "center top",
                  objectFit: driver.photoFit ?? "cover",
                  transform: `translate(${driver.photoTranslateX ?? 0}%, 0.35rem) scale(${driver.photoScale ?? 1})`,
                }}
              />
            </div>
          </div>

          <div className="driver-standing-card__body">
            <div className="driver-standing-card__meta">
              <span>{standing.code ?? standing.driverId.slice(0, 3).toUpperCase()}</span>
              <span>{teamLabel}</span>
              <span>{standing.nationality ?? "Nationality pending"}</span>
              {driver.sourceTag === "fallback" ? <span>Portrait pending</span> : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
