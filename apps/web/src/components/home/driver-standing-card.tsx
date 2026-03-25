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
      <div className="driver-standing-card__topline">
        <span className="driver-standing-card__rank">P{standing.standingPosition}</span>
        <span className="driver-standing-card__points">
          {standing.points}
          <small>PTS</small>
        </span>
      </div>

      <div className="driver-standing-card__intro">
        <p className="driver-standing-card__team">{standing.teamName}</p>
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
              transform: `scale(${driver.photoScale ?? 1})`,
            }}
          />
        </div>
      </div>

      <div className="driver-standing-card__body">
        <div className="driver-standing-card__meta">
          <span>{standing.code ?? standing.driverId.slice(0, 3).toUpperCase()}</span>
          <span>{standing.nationality ?? "Nationality pending"}</span>
          {driver.sourceTag === "fallback" ? <span>Portrait pending</span> : null}
        </div>
      </div>
    </article>
  );
}
