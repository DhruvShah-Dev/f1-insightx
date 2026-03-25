import Image from "next/image";
import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

type TeamCarCardProps = {
  teamId: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  showMeta?: boolean;
  priority?: boolean;
};

export function TeamCarCard({
  teamId,
  title,
  subtitle,
  compact = false,
  showMeta = false,
  priority = false,
}: TeamCarCardProps) {
  const team = getTeamAsset(teamId);
  const imagePath = team.carImagePath;
  const hasImage = Boolean(imagePath);
  const displayTitle = title ?? team.label;
  const displaySubtitle = subtitle ?? "2026 team car";

  return (
    <div
      className={`team-car-card ${compact ? "team-car-card--compact" : ""}`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
        } as CSSProperties
      }
    >
      <div className="team-car-card__media">
        {hasImage ? (
          <AssetImage
            src={imagePath as string}
            fallbackSrc={team.fallbackImagePath}
            alt={team.carImageAlt}
            className="team-car-card__image"
            width={800}
            height={420}
            priority={priority}
            sizes={compact ? "(max-width: 959px) 100vw, 18rem" : "(max-width: 959px) 100vw, 22rem"}
            style={
              {
                objectPosition: team.imagePosition,
                objectFit: team.imageFit ?? "cover",
              } as CSSProperties
            }
          />
        ) : (
          <div className="team-car-card__fallback">
            <Image
              src={team.fallbackImagePath}
              alt=""
              aria-hidden="true"
              className="team-car-card__placeholder"
              width={800}
              height={420}
            />
            <div className="team-car-card__overlay">
              <span>{team.shortLabel}</span>
              <strong>{displayTitle}</strong>
              <p>{subtitle ?? "Team media placeholder"}</p>
            </div>
          </div>
        )}
      </div>
      {showMeta ? (
        <div className="team-car-card__body">
          <span className="team-car-card__eyebrow">{displaySubtitle}</span>
          <strong className="team-car-card__title">{displayTitle}</strong>
        </div>
      ) : null}
    </div>
  );
}
