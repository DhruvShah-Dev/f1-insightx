import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getTeamAsset, getTeamLogoPath } from "@/lib/ui/asset-manifest";
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
  const plate = team.badgePlate ?? "default";
  const logoPath = getTeamLogoPath(team, plate === "light" || plate === "gold" ? "light" : "dark");

  return (
    <article
      className={`constructor-standing-card constructor-standing-card--${variant}`}
      tabIndex={0}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
          "--team-logo-contrast": team.badgeContrastColor ?? team.secondary,
        } as CSSProperties
      }
    >
      <div className="constructor-standing-card__frame" aria-hidden="true" />
      <div className="constructor-standing-card__topline">
        <span>Constructors</span>
        <strong>{team.shortLabel}</strong>
      </div>
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
          <span className={`constructor-standing-card__logo-plate constructor-standing-card__logo-plate--${plate}`} aria-hidden="true">
            {logoPath ? (
              <AssetImage
                src={logoPath}
                fallbackSrc={team.fallbackImagePath}
                alt=""
                fill
                className="constructor-standing-card__logo"
                sizes={variant === "leader" ? "96px" : "72px"}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <span className="constructor-standing-card__logo-fallback">{team.shortLabel}</span>
            )}
          </span>
        </div>
      </div>

      <div className="constructor-standing-card__body">
        <span className="constructor-standing-card__kicker">Championship card</span>
        <h3 className="constructor-standing-card__title">{team.label}</h3>
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
        <div className="constructor-standing-card__serial" aria-hidden="true">
          <span>{standing.constructorId.replaceAll("_", "-")}</span>
          <span>Top 3</span>
        </div>
      </div>
    </article>
  );
}
