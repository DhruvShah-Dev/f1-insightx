import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getTeamAsset } from "@/lib/ui/asset-manifest";

type TeamIdentityBadgeProps = {
  teamId: string;
  label?: string;
  compact?: boolean;
};

export function TeamIdentityBadge({
  teamId,
  label,
  compact = false,
}: TeamIdentityBadgeProps) {
  const team = getTeamAsset(teamId);
  const plate = team.badgePlate ?? "default";
  const badgeLabel = label ?? team.label;

  return (
    <span
      className={`team-badge team-badge--${plate} ${compact ? "team-badge--compact" : ""}`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
          "--team-logo-contrast": team.badgeContrastColor ?? team.secondary,
        } as CSSProperties
      }
    >
      <span className="team-badge__mark" aria-hidden="true">
        {team.badgeAssetPath ? (
          <AssetImage
            src={team.badgeAssetPath}
            fallbackSrc={team.fallbackImagePath}
            alt=""
            fill
            className="team-badge__logo"
            sizes={compact ? "34px" : "42px"}
            style={{ objectFit: "contain" }}
          />
        ) : (
          <span className="team-badge__fallback">{team.shortLabel}</span>
        )}
      </span>
      <span className="team-badge__label">{badgeLabel}</span>
    </span>
  );
}
