"use client";

import type { CSSProperties } from "react";
import { AssetImage } from "@/components/ui/asset-image";
import { getTeamAsset, getTeamLogoPath } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMeta, getDriverImagePath } from "@/lib/ui/driver-asset-manifest";

type AccountAvatarProps = {
  constructorId: string;
  driverId: string;
  avatarType: "constructor_logo" | "driver_image";
  size?: "sm" | "lg";
};

export function AccountAvatar({
  constructorId,
  driverId,
  avatarType,
  size = "lg",
}: AccountAvatarProps) {
  const team = getTeamAsset(constructorId);
  const driver = getCurrentDriverMeta(driverId);
  const teamLogoPath = getTeamLogoPath(team, "dark");
  const avatarClassName = size === "sm" ? "account-avatar account-avatar--sm" : "account-avatar";

  if (avatarType === "driver_image" && (driver.photoPath || driver.fallbackPhotoPath)) {
    return (
      <div className={`${avatarClassName} account-avatar--driver`}>
        <AssetImage
          src={getDriverImagePath(driver, "headshot")}
          fallbackSrc={driver.fallbackPhotoPath}
          alt={driver.altText}
          fill
          className="account-avatar__image"
          sizes={size === "sm" ? "64px" : "120px"}
          style={{ objectPosition: driver.photoPosition, objectFit: driver.photoFit ?? "contain" }}
        />
      </div>
    );
  }

  if (teamLogoPath) {
    return (
      <div className={`${avatarClassName} account-avatar--team`}>
        <AssetImage
          src={teamLogoPath}
          fallbackSrc={team.fallbackImagePath}
          alt={`${team.label} logo`}
          fill
          className="account-avatar__image account-avatar__image--contain"
          sizes={size === "sm" ? "64px" : "120px"}
          style={{ objectFit: "contain" }}
        />
      </div>
    );
  }

  if (team.carImagePath) {
    return (
      <div className={`${avatarClassName} account-avatar--team`}>
        <AssetImage
          src={team.carImagePath}
          fallbackSrc={team.fallbackImagePath}
          alt={`${team.label} identity`}
          fill
          className="account-avatar__image account-avatar__image--contain"
          sizes={size === "sm" ? "64px" : "120px"}
          style={{ objectFit: "contain", objectPosition: team.imagePosition ?? "center center" }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${avatarClassName} account-avatar--team`}
      style={
        {
          "--team-primary": team.primary,
          "--team-secondary": team.secondary,
        } as CSSProperties
      }
    >
      <span className="account-avatar__badge">{team.shortLabel}</span>
    </div>
  );
}
