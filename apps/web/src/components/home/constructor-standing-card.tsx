import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import type { ConstructorStanding } from "@/lib/server/standings";

type ConstructorStandingCardProps = {
  standing: ConstructorStanding;
  priority?: boolean;
  variant?: "leader" | "podium" | "standard";
};

export function ConstructorStandingCard({
  standing,
  priority = false,
  variant = "standard",
}: ConstructorStandingCardProps) {
  const team = getTeamAsset(standing.constructorId);

  return (
    <article
      className={`constructor-standing-card constructor-standing-card--${variant}`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
        } as CSSProperties
      }
    >
      <div
        className="constructor-standing-card__media"
        style={
          {
            "--team-car-image": team.carImagePath ? `url(${team.carImagePath})` : "none",
            "--team-car-position": variant === "podium" ? "center center" : team.imagePosition,
            "--team-car-size": variant === "podium" ? "contain" : (team.imageFit ?? "cover"),
          } as CSSProperties
        }
      >
        <div className="constructor-standing-card__glow" aria-hidden="true" />
        {team.carImagePath ? (
          <AssetImage
            src={team.carImagePath}
            fallbackSrc={team.fallbackImagePath}
            alt={team.carImageAlt}
            className="constructor-standing-card__image"
            width={1200}
            height={630}
            priority={priority}
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 18rem"
            style={{
              objectPosition: variant === "podium" ? "center center" : team.imagePosition,
              objectFit: variant === "podium" ? "contain" : (team.imageFit ?? "cover"),
            }}
          />
        ) : (
          <AssetImage
            src={team.fallbackImagePath}
            fallbackSrc={team.fallbackImagePath}
            alt=""
            className="constructor-standing-card__image constructor-standing-card__image--fallback"
            width={1200}
            height={630}
            priority={priority}
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 18rem"
          />
        )}
        <div className="constructor-standing-card__overlay">
          <span className="constructor-standing-card__rank">P{standing.standingPosition}</span>
        </div>
      </div>

      <div className="constructor-standing-card__body">
        <h3 className="constructor-standing-card__title">{standing.constructorName}</h3>
        <div className="constructor-standing-card__metrics">
          <div>
            <span>Points</span>
            <strong>{standing.points}</strong>
          </div>
          <div>
            <span>Wins</span>
            <strong>{standing.wins}</strong>
          </div>
        </div>
      </div>
    </article>
  );
}
