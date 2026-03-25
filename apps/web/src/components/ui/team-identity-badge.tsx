import type { CSSProperties } from "react";
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

  return (
    <span
      className={`team-badge ${compact ? "team-badge--compact" : ""}`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
          "--team-accent": team.accent,
        } as CSSProperties
      }
    >
      <span className="team-badge__dot" />
      <span>{label ?? team.label}</span>
    </span>
  );
}
